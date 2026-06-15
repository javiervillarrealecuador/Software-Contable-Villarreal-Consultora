# Instalación del SRI Descargador — Guía Paso a Paso

## Dos computadoras involucradas

```
💻 ESTE PC (tu computador de trabajo, Tulcán)
   Aquí está el código desarrollado: C:\sri-descargador
   Aquí haces los pasos de preparación y transferencia

🖧 EL SERVIDOR (el otro equipo — i3-8100, 8GB RAM)
   Aquí correrá el descargador de forma permanente
   Aquí instalas PostgreSQL, PostgREST, PM2 y la app
```

**Cómo se conectan:**
Los dos equipos ya están en la misma red virtual Radmin VPN.
Usarás esa conexión para copiar los archivos de un equipo al otro.

---

## Arquitectura final (para tener claro el objetivo)

```
🖧 SERVIDOR (solo accesible desde la red interna)
   ├── sri-descargador   :3001  ← app Next.js (visible en red local)
   ├── proxy-pgrst       :3100  ← solo localhost, invisible en red
   ├── postgrest          :3101  ← solo localhost, invisible en red
   └── postgresql         :5432  ← solo localhost, invisible en red

💻 ESTE PC (y cualquier PC de la red local)
   └── Accede a http://IP-SERVIDOR:3001 para ver el panel del descargador
```

---

# ═══════════════════════════════════════════════════════
# 💻 PARTE 1 — LO QUE HACES EN ESTE PC (tu computador)
# ═══════════════════════════════════════════════════════

## Paso 1 — Verificar que el proyecto está listo

Abre una terminal (cmd o Git Bash) en este PC y ejecuta:

```bash
cd C:\sri-descargador
npm run build
```

Si termina sin errores, el proyecto está listo para transferir.
Si hay errores de TypeScript en `ats-xml.ts`, son previos y no afectan
el funcionamiento — el build igual genera los archivos necesarios.

---

## Paso 2 — Preparar los archivos para transferir al servidor

Necesitas copiar dos carpetas al servidor:

| Carpeta en este PC          | Destino en el servidor     | Contenido                          |
|-----------------------------|----------------------------|------------------------------------|
| `C:\sri-descargador\`       | `C:\sri-descargador\`      | Todo el código del descargador     |
| `C:\erp-ecuador\install\`   | `C:\erp-ecuador\install\`  | Scripts SQL, config, PM2, proxy    |

**Cómo copiar (elige el método que prefieras):**

**Opción A — Por Radmin VPN (carpeta compartida):**
1. En el servidor, comparte la carpeta `C:\` o crea una carpeta compartida
2. Desde este PC, accede a `\\IP-RADMIN-SERVIDOR\` en el Explorador de archivos
3. Copia ambas carpetas directamente

**Opción B — Por pendrive USB:**
1. Copia `C:\sri-descargador` y `C:\erp-ecuador\install` a un pendrive
2. Lleva el pendrive al servidor y copia al mismo destino

**Opción C — Por Git (si usas repositorio):**
```bash
# En este PC:
git add .
git commit -m "sri-descargador listo para servidor"
git push
# Luego en el servidor: git clone o git pull
```

---

## Paso 3 — Generar las claves JWT (en este PC)

Ejecuta desde este PC para generar las claves que necesitará el servidor:

```bash
node C:\erp-ecuador\install\generate-keys.js
```

Guarda los tres valores que imprime (también quedan en `claves-generadas.txt`):
```
JWT_SECRET="..."      ← lo necesitas en el servidor (Paso 8)
ANON_KEY="eyJ..."     ← lo necesitas en el servidor (Paso 9)
SERVICE_ROLE_KEY="eyJ..." ← lo necesitas en el servidor (Paso 9)
```

> Puedes copiar este archivo `claves-generadas.txt` al pendrive o compartirlo
> por Radmin VPN junto con los demás archivos.

---

# ═══════════════════════════════════════════════════════
# 🖧 PARTE 2 — LO QUE HACES EN EL SERVIDOR (otra PC)
# ═══════════════════════════════════════════════════════

Conéctate físicamente al servidor (o usa Escritorio Remoto si ya lo tienes).
Todos los pasos siguientes se ejecutan en esa máquina.

---

## Paso 4 — Instalar Node.js en el servidor

Descarga **Node.js 20 LTS** para Windows:
https://nodejs.org/en/download

Selecciona: Windows Installer (.msi) — 64-bit

Instala con opciones por defecto. Al finalizar, abre `cmd` y verifica:
```bash
node --version    # debe mostrar v20.x.x
npm --version     # debe mostrar 10.x.x
```

---

## Paso 5 — Instalar PostgreSQL en el servidor

Descarga **PostgreSQL 16** para Windows:
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

Durante la instalación:
- Componentes: PostgreSQL Server ✓ · pgAdmin 4 ✓ · Command Line Tools ✓
- Puerto: **5432** (no cambiar)
- Contraseña del usuario `postgres`: elige una **segura** y **anótala**
  (ej: `ServidorERP2024!`)
- Locale: Spanish, Ecuador

---

## Paso 6 — Instalar Google Chrome en el servidor

El descargador usa Chrome para acceder al portal del SRI.

Descarga desde: https://www.google.com/chrome/

Instala normalmente. Anota la ruta de instalación (generalmente:
`C:\Program Files\Google\Chrome\Application\chrome.exe`).

---

## Paso 7 — Crear la base de datos

Abre **pgAdmin 4** (se instaló con PostgreSQL).

Conéctate al servidor local:
- Host: localhost · Puerto: 5432 · Usuario: postgres · Contraseña: la del Paso 5

Crea la base de datos:
```sql
-- En pgAdmin → clic derecho sobre "Databases" → Create → Database
-- O en Query Tool conectado a postgres:
CREATE DATABASE sri_descargador
  ENCODING 'UTF8'
  TEMPLATE template0;
```

Luego ejecuta los dos scripts SQL en **este orden**:

**7a) Primero: `schema-roles.sql`**

Abre el archivo `C:\erp-ecuador\install\schema-roles.sql` en Notepad.
Busca la línea:
```sql
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'CAMBIA_ESTA_PASSWORD';
```
Cambia `CAMBIA_ESTA_PASSWORD` por una contraseña real (ej: `PgrAuth2024!`). Guarda.

En pgAdmin → selecciona la BD `sri_descargador` → Tools → Query Tool →
abre el archivo y ejecuta (F5).

**7b) Segundo: `schema-descargador.sql`**

Sin cambios previos. En pgAdmin → misma BD `sri_descargador` →
abre `C:\erp-ecuador\install\schema-descargador.sql` y ejecuta (F5).

Verifica que creó las tablas:
```sql
\dt
-- Debe mostrar: res_partner, sri_distribution_batch,
--               sri_client_download, sri_xml_downloaded,
--               sri_download_error_log
```

---

## Paso 8 — Instalar y configurar PostgREST

**Descargar PostgREST:**
Desde el servidor, descarga:
https://github.com/PostgREST/postgrest/releases/latest

Archivo: `postgrest-v12.x.x-windows-x64.zip`

Descomprime y copia `postgrest.exe` a: `C:\postgrest\postgrest.exe`

**Configurar PostgREST:**

Copia el archivo template:
```
Copia:  C:\erp-ecuador\install\postgrest-descargador.conf.template
Como:   C:\erp-ecuador\install\postgrest-descargador.conf
```

Abre `postgrest-descargador.conf` en Notepad y reemplaza los dos marcadores:

1. `CAMBIA_ESTA_PASSWORD` → la contraseña del usuario `authenticator` que pusiste en el Paso 7a
2. `PEGA_EL_JWT_SECRET` → el `JWT_SECRET` que generaste en el Paso 3

Ejemplo del resultado:
```
db-uri    = "postgres://authenticator:PgrAuth2024!@localhost:5432/sri_descargador"
jwt-secret = "02559bbdeb087e221a1c71a30009a7c..."
server-port = 3101
server-host = "127.0.0.1"
```

---

## Paso 9 — Configurar el descargador

Copia el template de entorno:
```
Copia:  C:\erp-ecuador\install\descargador-env.local.example
Como:   C:\sri-descargador\.env.local
```

Abre `C:\sri-descargador\.env.local` en Notepad y rellena:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3100
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   ← ANON_KEY del Paso 3
SUPABASE_SERVICE_ROLE_KEY=eyJ...       ← SERVICE_ROLE_KEY del Paso 3

CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
SRI_HEADLESS=true

SCHEDULER_SECRET=pon_aqui_una_clave_que_inventes
PORT=3001
```

Para el `SCHEDULER_SECRET`, genera una clave en cmd:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## Paso 10 — Compilar el descargador en el servidor

```bash
cd C:\sri-descargador
npm install
npm run build
mkdir C:\sri-descargador\logs
```

El `npm install` puede tardar unos minutos (descarga dependencias).
El `npm run build` tarda 2-3 minutos.

---

## Paso 11 — Instalar PM2 y arrancar todo

```bash
# Instalar PM2 y el módulo de inicio de Windows (una sola vez)
npm install -g pm2
npm install -g pm2-windows-startup

# Arrancar los 3 procesos del descargador
pm2 start C:\erp-ecuador\install\pm2-descargador.config.js

# Verificar estado
pm2 status
```

Debes ver los 3 procesos en verde:
```
┌──────────────────┬────────┐
│ name             │ status │
├──────────────────┼────────┤
│ proxy-pgrst      │ online │
│ postgrest-desc   │ online │
│ sri-descargador  │ online │
└──────────────────┴────────┘
```

Prueba en el navegador del servidor:
```
http://localhost:3001
```
Debes ver el panel del descargador.

---

## Paso 12 — Configurar arranque automático con Windows

Para que todo arranque solo al reiniciar el servidor:

```bash
pm2 save
pm2-windows-startup install
```

`pm2-windows-startup install` muestra un comando de PowerShell. Cópialo y
ejecútalo en PowerShell (como Administrador). Luego reinicia el servidor
y verifica que `http://localhost:3001` carga sin intervención manual.

---

## Paso 13 — Abrir el puerto 3001 en el Firewall de Windows

Para que otros PCs de la red local puedan acceder al descargador:

1. Busca en Inicio: **"Windows Defender Firewall with Advanced Security"**
2. Haz clic en **Inbound Rules** → **New Rule**
3. Selecciona **Port** → Next
4. TCP → Specific local ports: `3001` → Next
5. **Allow the connection** → Next
6. Marca solo **Private** (red privada, no pública) → Next
7. Nombre: `SRI Descargador` → Finish

Desde este PC u otro PC de la red, prueba:
```
http://IP-LOCAL-SERVIDOR:3001
```
(La IP local del servidor la ves en: cmd → `ipconfig` → "Dirección IPv4")

---

## Paso 14 — Agregar clientes SRI (primera vez)

Los clientes para los que va a descargar el sistema se ingresan en la
tabla `res_partner` de la base de datos local.

Desde el servidor, abre pgAdmin 4 → `sri_descargador` → `public` →
`res_partner` → clic derecho → **View/Edit Data → All Rows**.

Agrega una fila por cliente:

| Campo        | Ejemplo                      | Descripción                   |
|-------------|------------------------------|-------------------------------|
| name        | EMPRESA ABC S.A.             | Razón social                  |
| vat         | 0400123456001                | RUC del cliente (13 dígitos)  |
| sri_user    | contador@empresa.com         | Usuario del portal SRI        |
| sri_password| ClavePortalSRI123            | Contraseña del portal SRI     |
| active      | true                         | Activo para descarga          |

---

# ═══════════════════════════════════════
# ✅ RESUMEN RÁPIDO DE REFERENCIA
# ═══════════════════════════════════════

## 💻 En este PC (haces una sola vez):
1. `npm run build` en `C:\sri-descargador` → verifica que compila
2. `node C:\erp-ecuador\install\generate-keys.js` → guarda las 3 claves
3. Copiar `C:\sri-descargador\` y `C:\erp-ecuador\install\` al servidor

## 🖧 En el servidor (instalación permanente):
4. Instalar Node.js 20 LTS
5. Instalar PostgreSQL 16 + crear BD `sri_descargador`
6. Instalar Google Chrome
7. Ejecutar `schema-roles.sql` (editar contraseña primero)
8. Ejecutar `schema-descargador.sql`
9. Descargar `postgrest.exe` → `C:\postgrest\postgrest.exe`
10. Crear `postgrest-descargador.conf` (rellenar contraseña + JWT_SECRET)
11. Crear `C:\sri-descargador\.env.local` (rellenar ANON_KEY + SERVICE_ROLE_KEY)
12. `npm install && npm run build` en `C:\sri-descargador`
13. `npm install -g pm2 pm2-windows-startup`
14. `pm2 start C:\erp-ecuador\install\pm2-descargador.config.js`
15. `pm2 save && pm2-windows-startup install`
16. Regla de firewall para puerto 3001
17. Agregar clientes en pgAdmin → tabla `res_partner`

---

## Comandos PM2 del día a día (en el servidor)

```bash
pm2 status                      # ver si todo está online
pm2 logs sri-descargador        # ver logs de la app
pm2 restart sri-descargador     # reiniciar solo la app
pm2 restart all                  # reiniciar todo el stack
```

