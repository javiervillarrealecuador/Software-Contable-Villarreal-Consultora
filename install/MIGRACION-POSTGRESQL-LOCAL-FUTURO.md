# Guía de Instalación — ERP Ecuador en Servidor Local

**Objetivo:** Migrar de Supabase cloud a PostgreSQL nativo en Windows, con acceso remoto por Radmin VPN.

**Arquitectura final:**
```
Clientes (oficinas remotas)
  │  Radmin VPN (red virtual cifrada)
  ▼
Servidor Windows (tu equipo i3-8100 / 8GB RAM)
  ├── ERP Next.js          :3000  ← accesible por clientes
  ├── SRI Descargador      :3001  ← accesible por admin
  ├── Proxy (supabase-js)  :3100  ← interno
  ├── PostgREST            :3101  ← interno
  └── PostgreSQL           :5432  ← interno
```

---

## PASO 1 — Exportar datos de Supabase (hacer una vez)

En la consola de Supabase Dashboard → Settings → Database, copia la **Connection string (URI)**. Tiene este formato:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Abre **Git Bash** (ya está instalado en tu PC) y ejecuta:
```bash
# Crear carpeta de trabajo
mkdir -p /c/erp-backup

# Exportar TODO (schema + datos) en formato comprimido
pg_dump -Fc \
  "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -f /c/erp-backup/supabase-backup.dump

# Si pg_dump no está en el PATH, primero agrégalo:
# (el instalador de PostgreSQL local lo pone en C:\Program Files\PostgreSQL\16\bin)
```

> **Nota:** Si `pg_dump` aún no está instalado, instala primero PostgreSQL (Paso 2) y luego vuelve aquí.

---

## PASO 2 — Instalar PostgreSQL en Windows

1. Descarga **PostgreSQL 16** para Windows desde:
   https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. Ejecuta el instalador. En la pantalla de componentes, marca:
   - PostgreSQL Server ✓
   - pgAdmin 4 ✓
   - Command Line Tools ✓
   - Stack Builder ✗ (no es necesario)

3. Cuando pida contraseña del usuario `postgres`, elige una **segura** y anótala.
   (Ejemplo: `ErpEcuador2024!`)

4. Puerto: déjalo en **5432** (por defecto).

5. Al finalizar, abre **pgAdmin 4** para verificar que el servidor local funciona.

---

## PASO 3 — Crear la base de datos y los roles

Abre **SQL Shell (psql)** o usa pgAdmin 4 → Query Tool.

Conéctate como `postgres`:
```bash
# Desde Git Bash:
psql -U postgres -h localhost
```

Ejecuta:
```sql
-- Crear la base de datos del ERP
CREATE DATABASE erp_ecuador
  ENCODING 'UTF8'
  LC_COLLATE 'Spanish_Ecuador.1252'
  LC_CTYPE 'Spanish_Ecuador.1252'
  TEMPLATE template0;

-- Conectarse a ella
\c erp_ecuador
```

Luego ejecuta el script de roles (en pgAdmin: File → Open, navega a `C:\erp-ecuador\install\schema-roles.sql`):
```bash
# Desde psql o Git Bash:
psql -U postgres -d erp_ecuador -f "C:\erp-ecuador\install\schema-roles.sql"
```

> **IMPORTANTE:** Antes de ejecutar ese script, abre `schema-roles.sql` en Notepad y **cambia `CAMBIA_ESTA_PASSWORD`** por una contraseña real (ej. `PgrAuth2024!`). Esta es la contraseña del usuario `authenticator` que usará PostgREST.

---

## PASO 4 — Restaurar el backup de Supabase

```bash
# En Git Bash:
pg_restore \
  --host localhost \
  --port 5432 \
  --username postgres \
  --dbname erp_ecuador \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  /c/erp-backup/supabase-backup.dump
```

Esto restaura todas las tablas, datos, índices y secuencias. Los warnings sobre roles de Supabase son normales y pueden ignorarse.

Verifica que los datos llegaron:
```sql
-- En psql o pgAdmin:
\c erp_ecuador
SELECT COUNT(*) FROM res_company;
SELECT name, vat FROM res_company;
```

---

## PASO 5 — Aplicar grants a las tablas restauradas

Después de restaurar, aplica los permisos para PostgREST:
```bash
psql -U postgres -d erp_ecuador -f "C:\erp-ecuador\install\schema-roles.sql"
```

(Ejecutar el mismo archivo una segunda vez es seguro — el `DO $$ IF NOT EXISTS $$` protege contra duplicados.)

---

## PASO 6 — Instalar PostgREST

PostgREST es un ejecutable único de ~15MB. No requiere instalación.

1. Descarga **PostgREST para Windows** desde:
   https://github.com/PostgREST/postgrest/releases/latest

   Busca el archivo: `postgrest-v12.x.x-windows-x64.zip`

2. Descomprime y copia `postgrest.exe` a `C:\postgrest\postgrest.exe`

3. Copia la configuración:
   ```
   Copia:  C:\erp-ecuador\install\postgrest.conf.template
   Como:   C:\erp-ecuador\install\postgrest.conf
   ```

4. Abre `C:\erp-ecuador\install\postgrest.conf` y rellena:
   - La contraseña del usuario `authenticator` (la que pusiste en schema-roles.sql)
   - El `jwt-secret` (lo generas en el Paso 7)

---

## PASO 7 — Generar las claves JWT

```bash
# En Git Bash o cmd, en la carpeta del proyecto:
cd C:\erp-ecuador\install
node generate-keys.js
```

El script imprime tres valores:
```
JWT_SECRET="a3f8..."     ← va en postgrest.conf
ANON_KEY="eyJ..."        ← va en .env.local de las apps
SERVICE_ROLE_KEY="eyJ..."← va en .env.local de las apps
```

También se guardan en `C:\erp-ecuador\install\claves-generadas.txt`.

**Rellena postgrest.conf:**
Abre `C:\erp-ecuador\install\postgrest.conf` y pega el `JWT_SECRET` en la línea:
```
jwt-secret = "PEGA_AQUI_EL_JWT_SECRET..."
```

---

## PASO 8 — Configurar las aplicaciones

Crea (o edita) el archivo `.env.local` en cada proyecto:

**`C:\erp-ecuador\.env.local`**
```env
# Base de datos local (PostgREST vía proxy)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3100
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  ← pega ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJ...      ← pega SERVICE_ROLE_KEY

# Firma electrónica (sigue igual que antes)
SRI_P12_PATH=certificados/tu-firma.p12
SRI_P12_PASSWORD=tu_contraseña_p12

# Ambiente SRI
SRI_AMBIENTE=1
```

**`C:\sri-descargador\.env.local`**
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3100
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  ← pega ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJ...      ← pega SERVICE_ROLE_KEY
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
SRI_HEADLESS=true
SCHEDULER_SECRET=pon_aqui_una_clave_secreta_para_el_scheduler
PORT=3001
```

---

## PASO 9 — Compilar las aplicaciones (producción)

```bash
# ERP
cd C:\erp-ecuador
npm install
npm run build

# SRI Descargador
cd C:\sri-descargador
npm install
npm run build
```

Cada build tarda ~2-3 minutos. Si hay errores, son de TypeScript previos a esta sesión (en ats-xml.ts) y no afectan el funcionamiento.

---

## PASO 10 — Instalar PM2 y arrancar todo

```bash
# Instalar PM2 globalmente (una sola vez)
npm install -g pm2
npm install -g pm2-windows-startup

# Crear carpeta de logs
mkdir C:\erp-ecuador\logs

# Arrancar todos los procesos
pm2 start C:\erp-ecuador\install\ecosystem.config.js

# Ver estado
pm2 status

# Debe mostrar 4 procesos online:
# proxy-pgrst | postgrest | erp-ecuador | sri-descargador
```

---

## PASO 11 — Configurar inicio automático con Windows

Para que todo arranque solo cuando el servidor se reinicia:

```bash
# Configurar PM2 para inicio automático
pm2 save
pm2-startup install
```

Luego ejecuta el comando que te muestre `pm2-startup install` (normalmente algo como `Set-ExecutionPolicy...` en PowerShell).

**Verificación:**
- Reinicia el servidor
- Espera 1-2 minutos
- Abre `http://localhost:3000` en el servidor → debe mostrar el ERP

---

## PASO 12 — Acceso de clientes por Radmin VPN

Los clientes ya acceden a los archivos por Radmin VPN. Para el ERP es exactamente igual:

1. El servidor aparece en Radmin VPN con una IP virtual tipo `26.x.x.x`
2. Cada cliente abre su navegador y escribe: `http://26.x.x.x:3000`
3. El ERP carga normalmente

> No se necesita configuración adicional en el firewall si Radmin VPN ya funciona para compartir archivos.

**Para verificar que el puerto 3000 es accesible desde otro PC de la VPN:**
```bash
# En cualquier PC cliente con Radmin VPN conectado:
ping 26.x.x.x          # reemplaza con la IP virtual del servidor
curl http://26.x.x.x:3000   # o simplemente abre el navegador
```

---

## Comandos PM2 útiles para el día a día

```bash
pm2 status                    # ver estado de todos los procesos
pm2 logs erp-ecuador          # ver logs del ERP en tiempo real
pm2 logs postgrest            # ver logs de PostgREST
pm2 restart erp-ecuador       # reiniciar solo el ERP
pm2 restart all               # reiniciar todo
pm2 stop all                  # detener todo
pm2 monit                     # panel de monitoreo en consola
```

---

## Resolución de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| `502 Bad Gateway` en el ERP | PostgREST no arrancó | `pm2 logs postgrest` — verificar contraseña en postgrest.conf |
| `ECONNREFUSED 3101` | PostgREST caído | `pm2 restart postgrest` |
| `role "anon" does not exist` | Olvidaste ejecutar schema-roles.sql | Re-ejecutar el script |
| Los datos de Supabase no aparecen | Restore incompleto | Re-ejecutar `pg_restore` con `--verbose` |
| Puerto 3000 no accesible desde cliente VPN | Firewall de Windows | Crear regla de entrada en Windows Defender Firewall para puertos 3000 y 3001 |

---

## Firewall de Windows (si los clientes no pueden conectar)

Si los clientes VPN no pueden abrir `http://26.x.x.x:3000`:

1. Abre **Windows Defender Firewall with Advanced Security**
2. Haz clic en **Inbound Rules → New Rule**
3. Type: **Port** → Next
4. TCP, Specific ports: `3000, 3001` → Next
5. Allow the connection → Next → Next
6. Nombre: `ERP Ecuador` → Finish

---

## Backup automático de PostgreSQL

Una vez funcionando, programa un backup diario. Crea `C:\erp-backup\backup-diario.bat`:
```bat
@echo off
set PGPASSWORD=tu_password_postgres
set DATE=%date:~6,4%-%date:~3,2%-%date:~0,2%
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" ^
  -U postgres -h localhost -d erp_ecuador -Fc ^
  -f "C:\erp-backup\erp_%DATE%.dump"
echo Backup completado: erp_%DATE%.dump
```

Programa este script en el **Programador de Tareas de Windows** para que corra diariamente.

