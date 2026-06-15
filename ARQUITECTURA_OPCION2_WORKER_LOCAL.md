# Arquitectura Opción 2: Worker Local + API REST

**Decisión:** Descargas desde máquinas locales, coordinadas por ERP-Ecuador en Supabase

---

## 1. VISTA GENERAL

```
┌─────────────────────────────────────────────────────────────┐
│ ERP ECUADOR (Vercel + Supabase)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ APIS NUEVAS (coordinación):                                 │
│ POST   /api/distribution/start-batch                        │
│        → Recibe 50 clientes, crea tarea mensual             │
│                                                              │
│ GET    /api/distribution/task?machine_id=1                  │
│        → Máquina 1 pregunta: "¿Qué clientes descargo?"     │
│        ← Respuesta: Clientes [A, F, K, ...]                │
│                                                              │
│ POST   /api/distribution/report-progress                    │
│        → Máquina reporta: "Descargué 50 docs de cliente A"  │
│                                                              │
│ POST   /api/distribution/report-error                       │
│        → Máquina reporta: "Error en cliente B: CAPTCHA"     │
│                                                              │
│ POST   /api/distribution/complete-batch                     │
│        → Máquina reporta: "Terminé mis clientes asignados"  │
│                                                              │
│ SUPABASE BD (logs + coordenación):                          │
│ ├─ sri_distribution_batch (1 por mes)                       │
│ ├─ sri_machine_task (5 filas, 1 por máquina)               │
│ ├─ sri_client_download (50 filas, 1 por cliente)           │
│ ├─ sri_xml_downloaded (15,000 filas, 1 por doc)            │
│ └─ purchase_order (nuevas, auto-importadas)                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
        ↑                                    ↓
        │ reporta progreso              asigna tareas
        │                                    
        │                                    
┌─────────────────────────────────────────────────────────────┐
│ 5 MÁQUINAS OPERATIVAS (worker local)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Máquina 1: /worker/sri-downloader-worker.ts (Node.js)      │
│ ├─ Al iniciar (1º de mes):                                  │
│ │  1. Pregunta al ERP: "¿Qué clientes descargo?"           │
│ │  2. Obtiene: [Cliente A, Cliente F, Cliente K]            │
│ │  3. Por cada cliente (secuencial):                         │
│ │     a) Descarga 300 docs con delays 7-10s                │
│ │     b) Guarda XML en /downloads/cliente_A/                │
│ │     c) Reporta progreso al ERP cada 50 docs              │
│ │  4. Procesa localmente: Parse XML → JSON                 │
│ │  5. Enva a ERP para importar en BD                        │
│ │  6. Reporta: "Completé 900 docs"                         │
│                                                              │
│ Máquinas 2-5: Mismo proceso (clientes distintos)            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ARCHIVOS A CREAR (29 archivos/cambios)

### EN ERP-ECUADOR (Next.js)

#### **APIs nuevas (6 archivos)**
```
src/app/api/distribution/
├─ route.ts                    [POST] Inicia batch mensual
├─ task/route.ts              [GET]  Máquina pregunta qué descargar
├─ progress/route.ts          [POST] Reporta progreso
├─ error/route.ts             [POST] Reporta errores
├─ complete/route.ts          [POST] Reporta completación
└─ batch-status/route.ts       [GET]  Estado total del batch
```

#### **Librerías nuevas (3 archivos)**
```
src/lib/
├─ distribution/              [NUEVA CARPETA]
│  ├─ distributor.ts          Lógica de asignación de clientes
│  ├─ batch-manager.ts        Manejo del batch mensual
│  └─ xml-processor.ts        Parse XML + importación
```

#### **Tablas Supabase (SQL)**
```
sri_distribution_batch
sri_machine_task
sri_client_download
sri_xml_downloaded
sri_download_error_log
```

#### **UI nuevas (2 archivos)**
```
src/app/
├─ distribution/
│  ├─ page.tsx                Dashboard de distribución
│  └─ batch-progress.tsx      Componente de progreso en tiempo real
```

### EN MÁQUINAS LOCALES (Worker Node.js)

#### **Worker standalone (12 archivos)**
```
worker/
├─ sri-downloader-worker.ts       Archivo principal
├─ lib/
│  ├─ erp-client.ts              Cliente HTTP al ERP
│  ├─ sri-session.ts             Manejo de sesiones SRI
│  ├─ sri-downloader.ts          Lógica descarga (con delays)
│  ├─ xml-parser.ts              Parse XML → JSON
│  ├─ retry-strategy.ts          Reintentos inteligentes
│  ├─ captcha-resolver.ts        Resolución de CAPTCHAs
│  ├─ logger.ts                  Logging local
│  └─ config.ts                  Variables de entorno
├─ package.json                  Dependencias (node-fetch, cheerio, etc)
├─ .env.example                  Template de variables
├─ tsconfig.json                 Config TypeScript
└─ install-service.ts            Script para instalar como servicio Windows

worker/certs/
├─ client-certificate.pem        (opcional, si SRI requiere cert cliente)
└─ client-key.pem
```

---

## 3. FLUJO COMPLETO (Timeline del 1-10 del mes)

### **DÍA 0 (30 de mes anterior, 23:00)**
```
Usuario:
1. Va a /distribution en el ERP
2. Sube lista de 50 clientes + credenciales SRI
3. Hace clic: "Iniciar descarga 1-10"

ERP:
1. Valida datos (RUC, credenciales)
2. Crea sri_distribution_batch (estado: 'pending')
3. Distribuye 50 clientes a 5 máquinas (10 cada una)
4. Crea 5 filas en sri_machine_task
5. Crea 50 filas en sri_client_download
6. Responde: "Batch iniciado. Máquinas descargarán automáticamente"

Máquinas:
- Permanecen en reposo (worker cron espera 00:00)
```

### **DÍA 1 (1 de mes, 00:00)**
```
Máquina 1:
1. Cron job ejecuta: npm run start-worker
2. Worker se conecta a ERP (GET /api/distribution/task?machine_id=1)
3. Obtiene: { machine_id: 1, clients: ['Cliente A', 'Cliente F', 'Cliente K', ...] }
4. Inicia descarga de Cliente A (300 docs)
5. Por cada doc:
   - Descarga desde SRI
   - Guarda XML en ./downloads/cliente_a/
   - Espera 7-10s
   - Reporta cada 50 docs: POST /api/distribution/progress
6. Termina Cliente A, comienza Cliente F

Máquinas 2-5: Lo mismo en paralelo (clientes distintos)

SRI ve:
├─ IP única, pero 5 usuarios descargando clientes DIFERENTES
├─ Patrón natural (como oficina con 5 empleados)
└─ NO detecta bot
```

### **DÍAS 2-10 (Descarga continua)**
```
Cada máquina:
- Descarga sus clientes asignados (secuencial)
- Reporta progreso cada hora
- Reintentos automáticos si hay error (CAPTCHA, timeout, etc)
- Procesa XMLs localmente (parse + JSON)
- Enva a ERP para importación
```

### **DÍA 10 (10 de mes, 23:59)**
```
Máquina 1: Termina último cliente, reporta completación
Máquina 2: Termina último cliente, reporta completación
...
Máquina 5: Termina último cliente, reporta completación

ERP:
1. Detecta: "Todas las máquinas completaron"
2. Importa todos los XMLs a purchase_order
3. Calcula retenciones automáticamente
4. Registra asientos contables
5. Actualiza estado batch: 'completed'
6. Enviá notificación: "15,000 docs descargados, X importados, Y errores"
```

---

## 4. ESTRUCTURA DE DIRECTORIOS (Proyecto completo)

```
erp-ecuador/
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── distribution/           [NUEVA CARPETA]
│   │   │       ├── route.ts
│   │   │       ├── task/route.ts
│   │   │       ├── progress/route.ts
│   │   │       ├── error/route.ts
│   │   │       ├── complete/route.ts
│   │   │       └── batch-status/route.ts
│   │   │
│   │   ├── distribution/               [NUEVA CARPETA]
│   │   │   ├── page.tsx                (Dashboard)
│   │   │   └── batch-progress.tsx      (Componente progreso)
│   │   │
│   │   └── purchases/
│   │       └── page.tsx                [AGREGAR botón "Descarga SRI"]
│   │
│   └── lib/
│       ├── distribution/               [NUEVA CARPETA]
│       │   ├── distributor.ts
│       │   ├── batch-manager.ts
│       │   └── xml-processor.ts
│       │
│       ├── (archivos existentes)
│       │   ├── sri-docs.ts
│       │   ├── sri-factura.ts
│       │   ├── purchases.ts
│       │   └── erp-accounting.ts
│       │
│       └── supabase.ts                 [SIN CAMBIOS]
│
├── worker/                             [NUEVA CARPETA - CORRE EN MÁQUINAS]
│   ├── sri-downloader-worker.ts        (Punto de entrada)
│   │
│   ├── lib/
│   │   ├── erp-client.ts               (HTTP client)
│   │   ├── sri-session.ts              (Sesiones SRI)
│   │   ├── sri-downloader.ts           (Descarga + delays)
│   │   ├── xml-parser.ts               (Parse)
│   │   ├── retry-strategy.ts           (Reintentos)
│   │   ├── captcha-resolver.ts         (CAPTCHAs)
│   │   ├── logger.ts                   (Logging)
│   │   └── config.ts                   (Env vars)
│   │
│   ├── certs/                          (Certificados opcionales)
│   │   ├── client-certificate.pem
│   │   └── client-key.pem
│   │
│   ├── downloads/                      (Temporal, se limpia)
│   │   ├── cliente_a/
│   │   ├── cliente_f/
│   │   └── ...
│   │
│   ├── logs/                           (Logs locales)
│   │   ├── 2026-06-01.log
│   │   ├── 2026-06-02.log
│   │   └── ...
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── .env                            (NO commitar)
│   └── install-service.ts              (Para Windows Service)
│
├── supabase/
│   └── migrations/
│       └── 010_sri_distribution.sql    (Nuevas tablas)
│
├── ARQUITECTURA_OPCION2_WORKER_LOCAL.md (Este archivo)
└── README.md
```

---

## 5. ARCHIVOS SQL (Supabase)

```sql
-- Batch mensual
CREATE TABLE sri_distribution_batch (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_month DATE NOT NULL,
  total_clients INT,
  total_invoices INT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, error
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_by BIGINT REFERENCES auth.users(id)
);

-- Tarea asignada a cada máquina
CREATE TABLE sri_machine_task (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_id BIGINT NOT NULL REFERENCES sri_distribution_batch(id),
  machine_id INT NOT NULL, -- 1-5
  assigned_clients JSONB, -- [{id: 1, name: "Cliente A", ruc: "1234567890001"}, ...]
  total_invoices INT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, error
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  UNIQUE(batch_id, machine_id)
);

-- Por cada cliente en descarga
CREATE TABLE sri_client_download (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_id BIGINT NOT NULL REFERENCES sri_distribution_batch(id),
  machine_id INT NOT NULL,
  client_id INT NOT NULL,
  client_name VARCHAR(255),
  client_ruc VARCHAR(13),
  total_invoices INT DEFAULT 300,
  downloaded INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, error
  error_message TEXT,
  error_count INT DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  last_reported_at TIMESTAMP DEFAULT NOW()
);

-- Log de cada XML descargado
CREATE TABLE sri_xml_downloaded (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_id BIGINT NOT NULL REFERENCES sri_distribution_batch(id),
  machine_id INT NOT NULL,
  client_id INT NOT NULL,
  invoice_id VARCHAR(50),
  xml_hash VARCHAR(64), -- SHA256 para deduplicación
  file_size INT,
  status VARCHAR(20) DEFAULT 'downloaded', -- downloaded, processing, imported, error
  imported BOOLEAN DEFAULT FALSE,
  purchase_order_id BIGINT,
  error_message TEXT,
  downloaded_at TIMESTAMP DEFAULT NOW(),
  imported_at TIMESTAMP
);

-- Errores y reintentos
CREATE TABLE sri_download_error_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_id BIGINT NOT NULL REFERENCES sri_distribution_batch(id),
  machine_id INT NOT NULL,
  client_download_id BIGINT REFERENCES sri_client_download(id),
  error_type VARCHAR(50), -- 'captcha', 'timeout', 'auth_failed', 'network', etc
  error_message TEXT,
  attempt_number INT,
  retry_scheduled_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6. VARIABLES DE ENTORNO

### **En ERP-ECUADOR (.env.local)**
```
# Existentes (sin cambios)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Nuevas para distribución
DISTRIBUTION_SECRET_KEY=tu_clave_secreta_random
# (Para validar que los requests vienen de máquinas autorizadas)
```

### **En cada máquina (worker/.env)**
```
# Identificación
MACHINE_ID=1                    # 1-5, diferente en cada máquina
MACHINE_NAME="Máquina Contabilidad"

# Conexión a ERP
ERP_BASE_URL=https://tudominio.vercel.app
DISTRIBUTION_SECRET_KEY=tu_clave_secreta_random

# SRI (opcional si se encripta en BD)
SRI_USER=usuario@srilibrary
SRI_PASSWORD=encryptedpassword

# Descargas
DOWNLOAD_DIR=./downloads
LOG_DIR=./logs
MAX_PARALLEL_CLIENTS=1         # Siempre 1 (secuencial)
DELAY_BETWEEN_DOCS_MIN_MS=7000
DELAY_BETWEEN_DOCS_MAX_MS=10000

# Reintentos
MAX_RETRIES=3
RETRY_DELAY_MS=30000
CAPTCHA_WAIT_MINS=30           # Si hay CAPTCHA, esperar 30 min

# CapMonster (opcional para resolver CAPTCHAs)
CAPMONSTER_API_KEY=
CAPMONSTER_ENABLED=false
```

---

## 7. FASES DE IMPLEMENTACIÓN

### **Fase 1: Setup BD + APIs (6-8 horas)**
- [ ] Crear migration SQL (tablas)
- [ ] Crear `/api/distribution/route.ts` (POST inicia batch)
- [ ] Crear `/api/distribution/task/route.ts` (GET asigna tareas)
- [ ] Crear `/api/distribution/progress/route.ts` (POST reporta progreso)
- [ ] Crear `/api/distribution/error/route.ts` (POST reporta errores)
- [ ] Crear `/api/distribution/complete/route.ts` (POST terminación)
- [ ] Implementar `lib/distribution/distributor.ts` (lógica asignación)
- [ ] Implementar `lib/distribution/batch-manager.ts` (manejo batch)

### **Fase 2: Worker local (7-9 horas)**
- [ ] Crear estructura `/worker/`
- [ ] Implementar `/worker/lib/erp-client.ts` (HTTP)
- [ ] Implementar `/worker/lib/sri-session.ts` (sesiones)
- [ ] Implementar `/worker/lib/sri-downloader.ts` (descarga)
- [ ] Implementar `/worker/lib/xml-parser.ts` (parse)
- [ ] Implementar `/worker/lib/retry-strategy.ts` (reintentos)
- [ ] Implementar `/worker/lib/logger.ts` (logging)
- [ ] Crear `/worker/sri-downloader-worker.ts` (punto entrada)
- [ ] Crear `package.json` con dependencias

### **Fase 3: Importación + Contabilidad (5-6 horas)**
- [ ] Implementar `lib/distribution/xml-processor.ts`
- [ ] Integrar con `purchases.ts` (crear purchase_order)
- [ ] Integrar con `erp-accounting.ts` (asientos)
- [ ] Validar firma digital XML
- [ ] Test de importación de un XML

### **Fase 4: UI Dashboard (4-5 horas)**
- [ ] Crear `/app/distribution/page.tsx`
- [ ] Crear `/app/distribution/batch-progress.tsx`
- [ ] Agregar botón en `/app/purchases/page.tsx`
- [ ] WebSocket para progreso en tiempo real
- [ ] Alertas de error por toast/email

### **Fase 5: Instalación + Testing (4-6 horas)**
- [ ] Crear `worker/install-service.ts` (servicio Windows)
- [ ] Documentar instalación en cada máquina
- [ ] Test con 5 clientes (50 docs total)
- [ ] Medir CAPTCHAs, ajustar delays
- [ ] Test de reintentos
- [ ] Prueba prod con batch pequeño

**Total estimado: 26-34 horas**

---

## 8. CHECKLIST PRE-IMPLEMENTACIÓN

- [ ] Credenciales SRI (usuario/pass) de cada cliente
- [ ] Certificados digitales (si SRI los requiere)
- [ ] Acceso a Supabase para crear migration
- [ ] Acceso a Vercel para desplegar Next.js
- [ ] Acceso a las 5 máquinas para instalar worker
- [ ] Windows Service permisos (si es Windows)
- [ ] IP pública de las 5 máquinas (para whitelist?)
- [ ] Credenciales de CapMonster (opcional)

---

## 9. CONSIDERACIONES DE SEGURIDAD

⚠️ **Credenciales SRI:** 
- Encriptar en BD con Supabase vault
- Worker descifra solo cuando lo necesita
- Nunca loguear credenciales

⚠️ **Secret key (distribución):**
- Usar HMAC para validar requests de máquinas
- Cambiar anualmente

⚠️ **Certificados:**
- Guardar en `/worker/certs/` (git-ignored)
- Proteger con permisos de archivo

⚠️ **XMLs descargados:**
- Borrar de `/worker/downloads/` después de importar
- O encriptar en reposo si se guardan

---

## 10. PRÓXIMO PASO

¿Procedo con **Fase 1 (APIs + BD)**?

Si sí, necesito que confirmes:

1. **¿Ya tienes lista la lista de 50 clientes con credenciales SRI?**
   - Formato esperado: `[{ ruc, nombre, sri_user, sri_pass }, ...]`

2. **¿Las credenciales están en algún lugar seguro o debo crear un módulo para ingresarlas vía UI?**

3. **¿Quieres que las máquinas se registren automáticamente o manual?**
   - Auto: Worker detecta su ID automáticamente
   - Manual: Tienes que asignar machine_id en .env

Confirma y comenzamos.

