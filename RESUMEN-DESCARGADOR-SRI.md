# RESUMEN COMPLETO DEL PROYECTO
## Descargador Centralizado de XMLs - Portal SRI Ecuador
**Fecha:** 13 de junio de 2026 | Para migrar al proyecto correcto

---

## 1. PROBLEMA A RESOLVER

5 computadoras descargan XMLs de comprobantes electrónicos del portal del SRI (srienlinea.sri.gob.ec). Todas comparten la misma IP pública. El SRI detecta las múltiples sesiones concurrentes como actividad de bot y activa CAPTCHAs continuamente, impidiendo el trabajo.

El proceso actual es 100% manual: cada operador abre el portal, inicia sesión con las credenciales del cliente, navega a Facturación Electrónica → Comprobantes electrónicos recibidos → filtra por fecha → descarga los XMLs uno por uno. No existe ningún script de automatización previo.

La única fuente de XMLs es el portal SRI; los proveedores no envían XMLs por correo electrónico.

---

## 2. SOLUCIÓN DISEÑADA

### 2.1 Enfoque: Centralización secuencial

Se descartaron las alternativas pagadas (SOAX proxy rotation ~$99/mes, CapMonster CAPTCHA solving ~$6/1000) porque no atacan la causa raíz. La solución elegida es centralizar todas las descargas en una sola máquina con ejecución secuencial y delays entre requests, simulando comportamiento humano. Costo: $0.

### 2.2 Arquitectura de dos fases

La solución separa el proceso en dos fases para minimizar la exposición al sistema de detección de bots:

**Fase 1 - Portal web (sensible a CAPTCHAs):**
Puppeteer (Chrome real automatizado) ingresa al portal SRI, inicia sesión con Keycloak, navega a comprobantes recibidos, y extrae las claves de acceso (números de 49 dígitos). Esta fase es la que dispara CAPTCHAs, por eso se ejecuta secuencialmente con delays de 5 segundos entre requests.

**Fase 2 - SOAP (sin restricciones):**
Con las claves de acceso obtenidas, se consulta el web service SOAP `consultarAutorizacion` (AutorizacionComprobantesOffline) que retorna el XML completo del comprobante. Este servicio NO tiene CAPTCHA ni rate limiting, así que puede ser más rápido (1 segundo entre llamadas).

### 2.3 Estrategia anti-detección

- Un solo navegador Chrome a la vez (no 5 máquinas paralelas)
- Delays configurables entre operaciones (5s portal, 1s SOAP)
- Propiedad `navigator.webdriver` ocultada
- User-Agent de Chrome real (porque ES Chrome real via Puppeteer)
- Tipeo con delays aleatorios simulando escritura humana
- Si detecta CAPTCHA en modo visible: pausa hasta 5 min para resolución manual
- Si detecta CAPTCHA en modo headless: pausa de 30 minutos (backoff configurable)

---

## 3. ARCHIVOS CREADOS Y MODIFICADOS

Todos los archivos están en el repositorio del ERP. Los marcados como NUEVO fueron creados desde cero.

| Archivo | Estado | Propósito |
|---------|--------|-----------|
| `src/lib/distribution/download-queue.ts` | NUEVO | Cola centralizada de descargas con rate limiting |
| `src/lib/distribution/sri-portal-client.ts` | NUEVO | Cliente Puppeteer para portal SRI (login + extracción claves) |
| `src/app/api/distribution/centralized/route.ts` | NUEVO | API endpoint POST/GET/DELETE para control desde UI |
| `scripts/download-sri.ts` | NUEVO | Script CLI standalone para ejecutar desde terminal |
| `src/lib/sri-soap.ts` | EXISTENTE | Cliente SOAP (consultarAutorizacion) - se usa sin cambios |
| `src/lib/supabase.ts` | EXISTENTE | Cliente Supabase compartido - causó problema de init |
| `src/lib/distribution/distributor.ts` | EXISTENTE | Distribución a 5 máquinas - será reemplazado |
| `src/lib/distribution/batch-manager.ts` | EXISTENTE | Tracking de batches - se mantiene |
| `package.json` | MODIFICADO | Agregados: puppeteer-core, tsx, cross-env, scripts npm |

---

## 4. DETALLE TÉCNICO DE CADA ARCHIVO NUEVO

### 4.1 download-queue.ts - Cola centralizada

Clase `DownloadQueue` que procesa jobs secuencialmente. Cada job corresponde a un cliente (RUC + credenciales SRI).

**Exports principales:**
- `QueueConfig`: interface de configuración (delays, reintentos, ambiente)
- `DownloadJob`: interface del job (clientId, clientName, clientRuc, sriUser, sriPassword, batchMonth)
- `FetchClavesFunction`: tipo de la función inyectable que obtiene claves del portal
- `DownloadQueue`: clase principal con métodos `enqueue()`, `start()`, `stop()`, `getStatus()`
- `setSupabaseClient()`: inyecta el cliente Supabase (evita problema de inicialización estática)

**Configuración por defecto:**
```
delayBetweenRequests: 5000ms    (5s entre cada request al portal)
captchaBackoffMs:     1800000ms (30 min al detectar CAPTCHA)
maxRetriesPerClient:  3
delayBetweenSoapCalls: 1000ms   (1s entre descargas SOAP)
ambiente:             2         (producción)
```

**Flujo de procesamiento:**
Para cada job: (1) llama a `fetchClaves()` para obtener claves de acceso del portal, (2) por cada clave, llama a `consultarAutorizacion()` SOAP para obtener el XML, (3) guarda resultado en Supabase. Si detecta CAPTCHA, pausa 30 minutos. Si falla 3 veces, marca el cliente como error y continúa con el siguiente.

**Inyección de Supabase:**
El cliente Supabase NO se importa estáticamente (esto causaba el error `supabaseUrl is required` al ejecutar desde CLI). En su lugar se inyecta via `setSupabaseClient()` antes de iniciar la cola. Internamente usa un Proxy que resuelve lazily, con fallback a `require('@/lib/supabase')` para el contexto Next.js.

### 4.2 sri-portal-client.ts - Cliente Puppeteer

Automatiza Chrome para interactuar con el portal del SRI. Maneja todo el flujo de autenticación Keycloak y extracción de datos.

**Descubrimientos del portal SRI:**
- Autenticación: Keycloak OpenID Connect con múltiples redirects
- Formulario de login: campos `usuario`, `ciAdicional`, `password`
- URL de comprobantes recibidos: `/tuportal-internet/accederAplicacion.jspa?redireccion=57&idGrupo=55`
- Las claves de acceso son números de exactamente 49 dígitos, extraídos con regex `/\b\d{49}\b/g`
- CAPTCHA: detectado por selectores `.g-recaptcha`, `iframe[src*="recaptcha"]`, y texto "Verificación de seguridad"

**Exports:**
- `fetchClavesFromSriPortal: FetchClavesFunction` - función principal que la cola usa
- `closeBrowser(): Promise<void>` - cierra el navegador al terminar

**Variables de entorno:**
```
CHROME_PATH:   ruta al ejecutable de Chrome (opcional, busca automáticamente)
SRI_HEADLESS:  'false' para modo visible con ventana (debug/CAPTCHA manual)
```

### 4.3 centralized/route.ts - API endpoint

API REST para controlar la descarga desde la interfaz web del ERP:
- `POST /api/distribution/centralized`: crea batch, encola todos los clientes, inicia cola en background
- `GET /api/distribution/centralized`: retorna estado actual de la cola
- `DELETE /api/distribution/centralized`: detiene la cola en ejecución

Usa un singleton `activeQueue` para garantizar una sola cola activa a la vez. `machine_id = 0` indica modo centralizado.

### 4.4 scripts/download-sri.ts - Script CLI

Script standalone para ejecutar desde terminal sin necesidad de levantar el servidor Next.js.

**Uso:**
```bash
npm run sri:download                    # modo headless
npm run sri:download:visible             # modo visible (debug/CAPTCHA)
npx tsx scripts/download-sri.ts 2026-05  # mes específico
```

**Resolución del problema de env vars:**
Lee `.env.local` directamente con `readFileSync` ANTES de cualquier import de módulos. Los módulos que dependen de variables de entorno (download-queue, sri-portal-client) se importan con `await import()` dinámico, que se ejecuta DESPUÉS de cargar las variables. El script crea su propio cliente Supabase y lo inyecta con `setSupabaseClient()`.

---

## 5. DEPENDENCIAS AGREGADAS

| Paquete | Tipo | Propósito |
|---------|------|-----------|
| `puppeteer-core` | dependency | Automatiza Chrome real para navegar el portal SRI |
| `tsx` | devDependency | Ejecuta TypeScript directamente desde CLI |
| `cross-env` | devDependency | Variables de entorno cross-platform en npm scripts |

---

## 6. TABLAS DE SUPABASE REQUERIDAS (NO EXISTEN AÚN)

El código asume estas tablas en Supabase. Ninguna existe todavía — deben crearse como migración:

**res_partner (o equivalente de clientes):**
Campos: id, name, vat (RUC), sri_user, sri_password, company_id, active

**sri_distribution_batch:**
Campos: id, batch_month, total_clients, total_invoices, status, created_by, completed_at, error_message

**sri_client_download:**
Campos: id, batch_id, machine_id, client_id, client_name, client_ruc, total_invoices, downloaded, status, started_at, completed_at, last_reported_at

**sri_xml_downloaded:**
Campos: id, batch_id, machine_id, client_id, invoice_id (clave acceso), xml_hash, file_size, status, numero_autorizacion, fecha_autorizacion. Unique constraint en (batch_id, invoice_id).

**sri_download_error_log:**
Campos: id, batch_id, machine_id, client_download_id, error_type, error_message, attempt_number, retry_scheduled_at, created_at

---

## 7. ESTADO ACTUAL Y PROBLEMAS PENDIENTES

### 7.1 Lo que funciona

- Arquitectura completa diseñada e implementada en código
- Cola de descargas con rate limiting y detección de CAPTCHA
- Cliente Puppeteer con login Keycloak y extracción de claves
- Cliente SOAP para descarga de XMLs (existente, probado)
- API endpoint REST para control desde UI
- Script CLI con resolución correcta de variables de entorno
- `npm install` exitoso (74 paquetes instalados)

### 7.2 Lo que NO funciona / está pendiente

**PROBLEMA CRÍTICO: Base de datos incorrecta.**
La instancia Supabase configurada en `.env.local` (`pevvuxoimshwwphaiwke.supabase.co`) pertenece a otro proyecto (mIAngel - gestión de autismo). No contiene ninguna de las tablas que el ERP necesita (res_partner, sri_distribution_batch, etc.).

**Pendientes:**
1. Conectar al proyecto Supabase correcto del ERP (o crear las tablas en uno nuevo)
2. Crear las migraciones SQL para las tablas requeridas (sección 6)
3. Cargar los datos de clientes (RUC, usuario SRI, contraseña SRI) desde el Excel/CSV que tiene el usuario
4. Probar el login al portal SRI con credenciales reales
5. Ajustar selectores CSS si el portal ha cambiado desde la inspección
6. Instalar Chrome en la máquina que ejecutará el script (o configurar CHROME_PATH)
7. Probar ejecución completa end-to-end

---

## 8. CONTEXTO DEL USUARIO

- Javier - Docente en Administración de Empresas, Universidad Politécnica Estatal del Carchi
- Gerente y consultor en contabilidad, tributación y área societaria en Ecuador
- Constructor inmobiliario en Tulcán
- Los datos de clientes (RUC, credenciales SRI) están en un archivo Excel/CSV
- Son pocos clientes (cantidad exacta no especificada)
- Menos de 50 facturas por día por cliente
- 5 PCs con control total, todas en la misma red/IP pública

---

## 9. REFERENCIA: WEB SERVICE SOAP DEL SRI

El servicio SOAP ya estaba implementado en `src/lib/sri-soap.ts`. Estos son los endpoints:

**Ambiente de pruebas (ambiente=1):**
```
https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline
```

**Ambiente de producción (ambiente=2):**
```
https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline
```

**Función `consultarAutorizacion`:**
Recibe una clave de acceso de 49 dígitos y el ambiente. Retorna: estado (AUTORIZADO/NO AUTORIZADO/EN PROCESO), numeroAutorizacion, fechaAutorizacion, y mensajes de error si los hay. Usa native `fetch` para la llamada SOAP.

---

## 10. INSTRUCCIONES PARA CONTINUAR EN EL PROYECTO CORRECTO

Al abrir el proyecto correcto en una nueva sesión, proporcionar este documento como contexto y seguir estos pasos:

1. Verificar que `.env.local` apunte al Supabase correcto del ERP
2. Crear las tablas de la sección 6 como migración SQL
3. Copiar los 4 archivos nuevos (download-queue.ts, sri-portal-client.ts, centralized/route.ts, download-sri.ts) al proyecto si no están
4. Verificar que `package.json` tenga las dependencias (puppeteer-core, tsx, cross-env)
5. Cargar datos de clientes desde Excel/CSV a la tabla de clientes
6. Ejecutar `npm run sri:download` para probar
