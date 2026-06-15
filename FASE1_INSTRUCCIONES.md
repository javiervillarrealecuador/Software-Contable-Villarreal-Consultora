# Fase 1: Setup BD + APIs - Instrucciones de Implementación

## ✅ COMPLETADO

Se han creado los siguientes archivos:

### 1. Migration SQL (Base de Datos)
```
supabase/migrations/010_sri_distribution.sql
```
**Contenido:** 5 nuevas tablas + índices + RLS policies

**Tablas creadas:**
- `sri_distribution_batch` - Batches mensuales
- `sri_machine_task` - Tareas asignadas a máquinas
- `sri_client_download` - Clientes siendo descargados
- `sri_xml_downloaded` - Log de XMLs descargados
- `sri_download_error_log` - Errores y reintentos

### 2. Librerías de Lógica
```
src/lib/distribution/
├─ distributor.ts      (Asignación dinámica de clientes a máquinas)
└─ batch-manager.ts    (Manejo de estados y reportes)
```

### 3. API Endpoints (6 archivos)
```
src/app/api/distribution/
├─ route.ts                    POST: Inicia batch
├─ task/route.ts              GET: Máquina obtiene clientes
├─ progress/route.ts          POST: Reporta progreso
├─ error/route.ts             POST: Reporta errores
├─ complete/route.ts          POST: Reporta completación
└─ batch-status/route.ts       GET: Estado del batch
```

---

## 🔧 PASOS PARA IMPLEMENTAR

### Paso 1: Aplicar Migration SQL

```bash
# Opción A: Usando Supabase CLI
cd erp-ecuador
supabase migration up

# Opción B: Manualmente en Supabase Dashboard
# 1. Ve a https://app.supabase.com
# 2. Selecciona tu proyecto
# 3. SQL Editor → New Query
# 4. Copia el contenido de supabase/migrations/010_sri_distribution.sql
# 5. Ejecuta
```

### Paso 2: Configurar variables de entorno

Edita `.env.local` (en la raíz de erp-ecuador):

```env
# Existentes (sin cambios)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# AGREGAR ESTAS NUEVAS:
DISTRIBUTION_SECRET_KEY=your-super-secret-random-key-12345
```

⚠️ **Genera una clave aleatoria segura:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Paso 3: Instalar dependencias (si es necesario)

Las dependencias ya están en package.json, así que solo:

```bash
npm install
```

### Paso 4: Test de APIs

Abre una terminal y corre el servidor en desarrollo:

```bash
npm run dev
```

Accede a http://localhost:3000

#### Test 1: Crear un batch de prueba

```bash
curl -X POST http://localhost:3000/api/distribution \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_month": "2026-06-01",
    "clients": [
      {
        "id": 1,
        "name": "Cliente A",
        "ruc": "1234567890001",
        "sri_user": "user_a",
        "sri_password": "pass_a",
        "invoice_count": 300
      },
      {
        "id": 2,
        "name": "Cliente B",
        "ruc": "1234567890002",
        "sri_user": "user_b",
        "sri_password": "pass_b",
        "invoice_count": 300
      },
      {
        "id": 3,
        "name": "Cliente C",
        "ruc": "1234567890003",
        "sri_user": "user_c",
        "sri_password": "pass_c",
        "invoice_count": 300
      }
    ]
  }'
```

⚠️ **Necesitas el JWT token de un usuario autenticado en Supabase**

#### Test 2: Obtener tarea de máquina

```bash
curl -X GET "http://localhost:3000/api/distribution/task?machine_id=1&batch_id=1" \
  -H "X-Distribution-Secret: your-super-secret-random-key-12345"
```

Respuesta esperada:
```json
{
  "success": true,
  "machine_id": 1,
  "batch_id": 1,
  "assigned_clients": [...],
  "total_invoices": 600,
  "status": "pending"
}
```

#### Test 3: Consultar estado del batch

```bash
curl -X GET "http://localhost:3000/api/distribution/batch-status?batch_id=1"
```

---

## 📋 CHECKLIST DE FASE 1

- [ ] Migration SQL ejecutada (5 tablas creadas)
- [ ] `.env.local` actualizado con `DISTRIBUTION_SECRET_KEY`
- [ ] `npm run dev` funciona sin errores
- [ ] Poder crear batch vía API
- [ ] Poder obtener tarea de máquina
- [ ] Poder consultar estado del batch
- [ ] BD Supabase tiene datos en `sri_distribution_batch`

---

## 🚀 PRÓXIMOS PASOS

Una vez completados los checklist arriba, procederemos a:

**Fase 2:** Crear el worker local Node.js que corre en cada máquina

**Qué hará el worker:**
1. Pregunta al ERP (GET /api/distribution/task): "¿Qué clientes descargo?"
2. Obtiene lista de clientes asignados
3. Para cada cliente:
   - Descarga 300 XMLs desde SRI
   - Espera 7-10s entre cada descarga (humanizado)
   - Reporta progreso (POST /api/distribution/progress)
4. Al terminar: reporta completación (POST /api/distribution/complete)

---

## 🐛 TROUBLESHOOTING

### Error: "Unauthorized" en las APIs

**Causa:** Falta el token JWT o el secret key

**Solución:** 
- Para POST /api/distribution: Necesitas estar autenticado en Supabase
- Para otros endpoints: Necesitas header `X-Distribution-Secret`

### Error: "DISTRIBUTION_SECRET_KEY is undefined"

**Solución:** Asegúrate de agregar en `.env.local`:
```env
DISTRIBUTION_SECRET_KEY=tu-clave-aleatoria
```

### Error: "Database connection failed"

**Solución:** Verifica que en `.env.local` tengas:
```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Las tablas no aparecen en Supabase

**Solución:** Ejecuta manualmente la migration:
1. Ve a SQL Editor en Supabase Dashboard
2. Copia contenido de `supabase/migrations/010_sri_distribution.sql`
3. Ejecuta

---

## 📝 NOTAS TÉCNICAS

- **RLS está habilitado** en todas las tablas, pero las máquinas pueden escribir via APIs
- **Indices creados** para queries frecuentes (batch status, machine tasks, etc)
- **Unique constraints** en batch_id+machine_id y batch_id+xml_hash para evitar duplicados
- **Foreign keys** referencian tablas correctamente (cascading deletes)

---

Cuando completes estos pasos, avísame y procedemos con **Fase 2: Worker local**.
