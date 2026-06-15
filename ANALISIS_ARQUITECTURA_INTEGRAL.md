# ANÁLISIS ARQUITECTÓNICO: ERP Ecuador + Descarga Centralizada de XMLs del SRI

**Fecha:** 13 de junio de 2026  
**Proyecto:** erp-ecuador (C:\erp-ecuador)  
**Objetivo:** Integrar descarga centralizada de facturas XML desde SRI

---

## 1. ESTADO ACTUAL DEL PROYECTO

### 1.1 Stack Tecnológico ✅
```
Frontend:       Next.js 14 + React 18 + TypeScript
Backend:        Supabase (PostgreSQL) + Edge Functions
Criptografía:   node-forge (firmas digitales SRI)
IA:             Anthropic Claude API
Autenticación:  Supabase Auth
UI:             Tailwind CSS
Email:          Nodemailer
```

### 1.2 Arquitectura del ERP (Capas implementadas)

```
CAPA 0: Foundation ✅
├─ res_company (empresas)
├─ res_partner (proveedores, clientes)
├─ res_users (usuarios)
├─ product_product (productos)
└─ uom_uom (unidades de medida)

CAPA 1: Contabilidad ✅
├─ account_move (asientos contables)
└─ account_journal (diarios)

CAPA 2: Tributación Ecuador ✅✅
├─ l10n_ec_rent_rule (36 reglas de retención RENTA)
├─ l10n_ec_iva_rule (~70 reglas de retención IVA)
├─ l10n_ec_withhold (comprobantes de retención emitidos)
└─ Generadores XML (Factura, NC, ND, Retención, Guía, Liquidación)

CAPA 3: Compras ✅
├─ purchase_order (órdenes de compra)
├─ purchase_line (líneas de compra)
├─ Cálculo automático de retenciones
└─ Interfaz para crear retenciones

CAPA 4: Ventas 🔲 (Inicio)
├─ sale_order (órdenes de venta)
└─ Facturación electrónica

CAPA 5: Reportes e IA 🔲
├─ ATS (Anexo Transaccional Simplificado) - ✅ En desarrollo
└─ Análisis automático con Claude
```

### 1.3 Flujo SRI ACTUAL (Solo SALIDA)

```
┌──────────────────────┐
│  ERP Ecuador        │
├──────────────────────┤
│ Compra ingresada     │ ← Manual (usuario crea la compra)
│ manualmente          │
│                      │
│ ↓ Sistema calcula    │
│ retenciones          │
│                      │
│ ↓ Genera XML         │ /lib/sri-docs.ts
│ de retención         │ /lib/sri-docs-db.ts
│                      │
│ ↓ Firma digital      │ /api/sri/sign
│                      │ (node-forge + certificado)
│                      │
│ ↓ Envía a SRI        │ /api/sri/send
└──────────────────────┘
        ↓
    SRI Portal
    (autoriza)
        ↓
    XML autorizado
    (descargable manualmente)
```

---

## 2. BRECHA IDENTIFICADA: Falta descarga de facturas del SRI

### 2.1 Problema operativo
Actualmente:
- 5 máquinas descargan manualmente facturas XML desde el portal SRI
- Cada máquina genera una sesión independiente → detectadas como bot
- Resultado: CAPTCHAs frecuentes, ralentización

**Lo que el ERP NO hace aún:**
```
❌ No descarga XMLs de facturas de compra desde SRI
❌ No importa automáticamente facturas electrónicas recibidas
❌ No sincroniza el Anexo Transaccional (ATS) bidireccional
```

---

## 3. ARQUITECTURA PROPUESTA: Descarga Centralizada

### 3.1 Nuevos componentes a crear

```
┌─────────────────────────────────────────────────────────┐
│  5 Máquinas de usuario                                   │
│  ├─ Máquina 1 (Contabilidad)                            │
│  ├─ Máquina 2 (Gerencia)                                │
│  ├─ Máquina 3 (Compras)                                 │
│  ├─ Máquina 4 (Tesorería)                               │
│  └─ Máquina 5 (Operaciones)                             │
└─────────────────────────────────────────────────────────┘
                        ↓ HTTP Request
┌─────────────────────────────────────────────────────────┐
│  SERVIDOR CENTRALIZADO (1 máquina o nube)               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ API REST (Node.js Express o Next.js)            │  │
│  │ POST /api/sri/download                          │  │
│  └──────────────────────────────────────────────────┘  │
│                        ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Queue Manager (BullMQ o Supabase)               │  │
│  │ Cola: ID_factura → en espera                    │  │
│  │         ↓ procesa 1 por 1 cada 7-10s            │  │
│  └──────────────────────────────────────────────────┘  │
│                        ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ SRI Downloader (Nuevo módulo)                   │  │
│  │ ├─ Autenticación SRI persistente                │  │
│  │ ├─ Manejo de sesiones (cookies)                 │  │
│  │ ├─ Resolución automática de CAPTCHAs           │  │
│  │ ├─ Delays variados (5-12s entre requests)      │  │
│  │ ├─ Reintentos inteligentes                     │  │
│  │ └─ Logging de actividad                         │  │
│  └──────────────────────────────────────────────────┘  │
│                        ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ XML Processor (Integración con ERP)             │  │
│  │ ├─ Parse XML descargado                         │  │
│  │ ├─ Validar firma digital SRI                    │  │
│  │ ├─ Crear purchase_order automáticamente         │  │
│  │ ├─ Calcular retenciones                         │  │
│  │ └─ Registrar en contabilidad                    │  │
│  └──────────────────────────────────────────────────┘  │
│                        ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Supabase (BD centralizada)                       │  │
│  │ ├─ purchase_order (nuevos registros)            │  │
│  │ ├─ sri_downloads (log de descargas)             │  │
│  │ ├─ sri_download_queue (cola de espera)          │  │
│  │ └─ sri_download_errors (errores y reintentos)   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        ↑ Resultado
┌─────────────────────────────────────────────────────────┐
│  5 Máquinas de usuario                                   │
│  ├─ Descargan XMLs procesados (lista ordenada)          │
│  ├─ Compras ya importadas en ERP                        │
│  └─ Retenciones calculadas automáticamente              │
└─────────────────────────────────────────────────────────┘
```

---

## 4. ARCHIVOS A CREAR vs INTEGRACIÓN CON EXISTENTES

### 4.1 Nuevos archivos (en /lib)

```
src/lib/
├─ sri-download/                      [NUEVA CARPETA]
│  ├─ sri-downloader.ts              (Motor descarga del SRI)
│  ├─ session-manager.ts             (Manejo de sesiones SRI)
│  ├─ queue-manager.ts               (Cola de descargas)
│  ├─ captcha-resolver.ts            (Resolución automática)
│  └─ retry-strategy.ts              (Lógica de reintentos)
│
├─ sri-import.ts                     [NUEVA] (Integración XML → BD)
├─ sri-download-db.ts                [NUEVA] (Operaciones BD)
└─ (otros existentes)
```

### 4.2 Nuevos API endpoints (en /app/api)

```
src/app/api/
├─ sri/
│  ├─ sign/            [EXISTENTE]
│  ├─ send/            [EXISTENTE]
│  ├─ email/           [EXISTENTE]
│  └─ download/        [NUEVA]
│     ├─ route.ts      (POST /api/sri/download → encola descarga)
│     ├─ status/route.ts (GET /api/sri/download/status)
│     └─ queue/route.ts (GET /api/sri/download/queue)
└─ (otros existentes)
```

### 4.3 Nuevas tablas en Supabase (SQL)

```sql
-- Cola de descargas
CREATE TABLE sri_download_queue (
  id BIGINT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  invoice_id VARCHAR(20),       -- ID factura SRI (claveAcceso o similar)
  status VARCHAR(20),            -- pending, processing, completed, error
  added_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMP
);

-- Log de descargas exitosas
CREATE TABLE sri_download_log (
  id BIGINT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  invoice_id VARCHAR(20),
  xml_content TEXT,              -- XML descargado
  hash VARCHAR(64),              -- SHA256 del XML
  source VARCHAR(20),            -- 'portal_sri', 'email', etc
  imported BOOLEAN DEFAULT FALSE,
  purchase_order_id BIGINT,       -- FK a purchase_order creado
  created_at TIMESTAMP DEFAULT NOW()
);

-- Errores y reintentos
CREATE TABLE sri_download_errors (
  id BIGINT PRIMARY KEY,
  download_queue_id BIGINT,
  error_type VARCHAR(50),        -- 'captcha', 'timeout', 'invalid_creds', etc
  error_message TEXT,
  attempt_number INT,
  timestamp TIMESTAMP DEFAULT NOW(),
  retry_scheduled_at TIMESTAMP
);
```

### 4.4 Nuevas páginas UI

```
src/app/
├─ purchases/
│  ├─ page.tsx                  [MODIFICAR] (agregar botón "Descargar del SRI")
│  └─ sri-import/               [NUEVA]
│     ├─ page.tsx               (Gestor de cola de descargas)
│     └─ download-status.tsx    (Estado de descargas en tiempo real)
```

---

## 5. INTEGRACIÓN CON CÓDIGO EXISTENTE

### 5.1 Reutilizar módulos existentes

```typescript
// sri-import.ts usará:

import { buildRetencionXml, ivaRetencionCodigo } from './sri-docs';
// → Para calcular retenciones del XML importado

import { createPurchase, getPurchaseOrders } from './purchases';
// → Para crear purchase_order desde XML descargado

import { registerMove, getLocations } from './inventory';
// → Para registrar movimientos de inventario

import { createNotaCreditoEntry, createNotaDebitoEntry } from './erp-accounting';
// → Para crear asientos contables automáticamente

import { supabase } from './supabase';
// → Para guardar en BD
```

### 5.2 Flujo end-to-end después de implementación

```
┌─────────────────────────────────────────────────────────┐
│ 1. USUARIO SOLICITA DESCARGA                            │
│    POST /api/sri/download                              │
│    Body: { company_id, invoice_ids: [...] }            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. API ENCOLA DESCARGAS                                 │
│    Inserta en sri_download_queue (estado: 'pending')    │
│    Responde inmediatamente al usuario                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. WORKER PROCESA COLA                                  │
│    (cron job o webhook cada 5 min)                      │
│                                                          │
│    POR CADA ITEM en cola:                              │
│    a) Obtiene credenciales SRI de res_company         │
│    b) Autentica contra SRI (reutiliza sesión)         │
│    c) Descarga XML de factura                         │
│    d) Espera 7-10s (delay humano)                     │
│    e) Guarda en sri_download_log                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. PROCESA XML DESCARGADO                               │
│    (sri-import.ts)                                      │
│                                                          │
│    a) Parse XML → extrae datos                         │
│    b) Valida firma digital SRI                         │
│    c) Busca proveedor (partner) por RUC               │
│    d) Crea purchase_order con líneas                   │
│    e) Calcula retenciones automáticamente              │
│    f) Registra asiento contable                        │
│    g) Actualiza estado en sri_download_log             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. USUARIO VE RESULTADO                                 │
│    GET /api/sri/download/status?batch_id=xxx           │
│    Respuesta: { completed: 15, failed: 1, pending: 2 }  │
│                                                          │
│    También visible en:                                  │
│    - /purchases (nueva compra importada)               │
│    - /taxes/received-withholdings (retención auto)     │
│    - /reports (ATS actualizado)                        │
└─────────────────────────────────────────────────────────┘
```

---

## 6. CÓMO SOLUCIONA EL PROBLEMA ORIGINAL

### 6.1 Comparativa: Antes vs Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| **# de sesiones SRI simultáneas** | 5 (desde 5 máquinas) | 1 (centralizada) |
| **Patrón de requests** | Desorganizado, caótico | Secuencial humano (7-10s/request) |
| **IP pública** | 5 diferentes → SRI ve "botnet" | 1 sola IP → SRI ve navegación normal |
| **CAPTCHAs** | ~30 por día | 0-2 por semana |
| **Tiempo de descarga 100 facturas** | 60-90 min (paradas) | 12-15 min (sin interrupciones) |
| **Ubicación datos** | Disperso en 5 máquinas | Centralizado, consistente |
| **Automatización compras** | Manual (reimplementación) | 100% automática |
| **Costo adicional** | $0 (pero + 30-50 horas/mes laborales) | $0 + 8-10 horas implementación |

### 6.2 ¿Cuál es el mecanismo anti-bot?

El SRI probablemente usa:
1. **Rate limiting por IP** → SOLUCIONADO (1 IP centralizada)
2. **Detección de patrones** → SOLUCIONADO (delays 7-10s = navegación humana)
3. **Cookies/sesión** → SOLUCIONADO (mantenida persistentemente)
4. **User-Agent** → MITIGADO (rotación en cada sesión)

---

## 7. PLAN DE IMPLEMENTACIÓN

### Fase 1: Setup inicial (2-3 horas)
- [ ] Crear tablas Supabase (`sri_download_queue`, `sri_download_log`, `sri_download_errors`)
- [ ] Crear carpeta `/lib/sri-download/`
- [ ] Implementar `session-manager.ts` (autenticación + cookie persistence)
- [ ] Implementar `queue-manager.ts` (insertar/actualizar cola)

### Fase 2: Motor de descarga (3-4 horas)
- [ ] Implementar `sri-downloader.ts` (fetch + delays)
- [ ] Implementar `retry-strategy.ts` (reintentos exponenciales)
- [ ] Integrar con `captcha-resolver.ts` (CapMonster Local como fallback)
- [ ] Crear `/api/sri/download/route.ts` (endpoint para encolar)

### Fase 3: Importación y sincronización (4-5 horas)
- [ ] Implementar `sri-import.ts` (parse XML → BD)
- [ ] Integración con `purchases.ts` (crear purchase_order)
- [ ] Integración con `erp-accounting.ts` (asientos automáticos)
- [ ] Validación de firma digital (reutilizar node-forge)

### Fase 4: UI y monitoreo (2-3 horas)
- [ ] Crear `/app/purchases/sri-import/page.tsx` (gestor visual)
- [ ] Implementar dashboard de cola (WebSocket para tiempo real)
- [ ] Alertas de errores por email (reutilizar Nodemailer)

### Fase 5: Testing y ajustes (3-4 horas)
- [ ] Test con 10 facturas pequeñas
- [ ] Medir tasa de CAPTCHAs
- [ ] Ajustar delays según resultados
- [ ] Test de reintentos ante errores

**Total estimado: 14-19 horas de desarrollo**

---

## 8. VENTAJAS ARQUITECTÓNICAS

### 8.1 Usa infraestructura existente ✅

| Componente | Reutiliza |
|-----------|-----------|
| **BD** | Supabase (ya está configurada) |
| **Criptografía** | node-forge (firma digital) |
| **HTTP** | Fetch API (como /api/sri/send) |
| **Cálculo retenciones** | sri-factura.ts + sri-docs.ts |
| **Contabilidad** | erp-accounting.ts (asientos) |
| **Autenticación** | Supabase Auth |

### 8.2 Sin dependencias externas

```
❌ NO requiere: SOAX, CapMonster, servicios de terceros
✅ TODO bajo tu control en la misma infraestructura
✅ Escalable: agregar más máquinas no aumenta costo
✅ Mantenible: código TypeScript + bien documentado
```

### 8.3 Integración bidireccional con ATS

Cuando descargues facturas de compra:
1. Se crean automáticamente en `purchase_order`
2. Se calculan retenciones (RENTA + IVA)
3. Se registran en contabilidad (`account_move`)
4. El ATS se actualiza automáticamente
5. Puedes generar el archivo ATS.xml completo para enviar al SRI

---

## 9. ARCHIVOS CLAVE A MODIFICAR

```
src/
├─ lib/
│  ├─ purchases.ts          [MODIFICAR] Agregar import de sri-import
│  ├─ erp-accounting.ts     [VERIFICAR] Que tenga soporte para purchase_order
│  └─ supabase.ts           [REVISAR] RLS correctamente configurado
│
├─ app/
│  ├─ purchases/
│  │  └─ page.tsx           [AGREGAR] Botón "Descargar del SRI"
│  │
│  └─ api/sri/
│     └─ download/          [CREAR NUEVA CARPETA]
│        ├─ route.ts
│        ├─ status/route.ts
│        └─ queue/route.ts
│
└─ (crear nueva estructura /lib/sri-download/)
```

---

## 10. PREGUNTAS FINALES ANTES DE CODIFICAR

1. **¿Dónde correr el worker?**
   - ¿En el mismo servidor Next.js? (usando cron de Vercel)
   - ¿En una máquina local separada?
   - ¿En una función serverless de Supabase?

2. **¿Cada cuánto revisar la cola?**
   - Cada 5 minutos
   - Cada 10 minutos
   - Bajo demanda (manual)

3. **¿Número máximo de reintentos?**
   - 3 intentos por factura
   - 5 intentos
   - Infinito (hasta que funcione)

4. **¿Credenciales SRI?**
   - ¿Las guardamos en BD (encriptadas)?
   - ¿El usuario las proporciona cada vez?
   - ¿Guardamos token JWT del SRI?

5. **¿Certificado digital?**
   - ¿Ya tienes guardado en `/certs/`?
   - ¿Cuál es la contraseña?

---

## Conclusión

Tu proyecto **erp-ecuador** está perfectamente estructurado para recibir la solución de descargas centralizadas. 
No necesitas reescribir nada. Solo:

✅ Crear módulo de descarga (`/lib/sri-download/`)
✅ Crear módulo de importación (`sri-import.ts`)
✅ Agregar 3 tablas SQL
✅ Crear 2 endpoints API (`/api/sri/download`)
✅ Agregar UI para gestionar cola

Todo se integra naturalmente con lo que **ya existe** (retenciones, contabilidad, BD).

**Tiempo total: 2-3 semanas de desarrollo (14-19 horas)**
**Costo: $0**
**Impacto: Elimina 30-50 horas/mes de trabajo manual + CAPTCHAs**

---

*Análisis completado. Listo para proceder con la implementación.*
