# ERP Ecuador - Construcción modular con IA integrada

## Arquitectura

```
CAPA 0: Foundation (Maestros)
  ├─ Empresas (multiempresa)
  ├─ Partners (clientes, proveedores, contactos)
  ├─ Usuarios y Roles
  ├─ Productos
  ├─ Unidades de Medida
  └─ Datos base (países, provincias, monedas)

CAPA 1: Contabilidad
CAPA 2: Tributación Ecuador
CAPA 3: Compras e Inventario
CAPA 4: Ventas
CAPA 5: Reportes y IA
```

## Quick Start

### 1. Clonar repositorio
```bash
git clone <repo-url>
cd erp-ecuador
npm install
```

### 2. Configurar Supabase

#### Crear proyecto en Supabase
- Ve a https://supabase.com
- Crea un proyecto nuevo
- Obtén:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Crear archivo .env.local
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

#### Ejecutar migraciones
```bash
# Opción 1: A través de Supabase CLI
supabase db push

# Opción 2: Copiar y pegar el SQL directamente en Supabase Console
# Ve a SQL Editor en dashboard de Supabase
# Copia el contenido de supabase/migrations/001_capa0_foundation.sql
# Ejecuta
```

### 3. Ejecutar en desarrollo
```bash
npm run dev
```

Accede a http://localhost:3000

## Estructura del Proyecto

```
erp-ecuador/
├── src/
│   ├── app/              # Next.js 14 app directory
│   ├── components/       # Componentes React
│   ├── lib/             # Funciones helper (Supabase, IA, etc)
│   └── types/           # Tipos TypeScript
├── public/              # Assets estáticos
├── supabase/
│   ├── migrations/      # SQL migrations
│   └── config.toml      # Config de Supabase
├── .env.local           # Variables de entorno (no commitar)
└── package.json
```

## CAPA 0 - Tablas disponibles

### res_company
Empresas del sistema (multiempresa)

```typescript
interface Company {
  id: number;
  name: string;
  vat: string;        // RUC
  currency_id: number;
  active: boolean;
}
```

### res_partner
Clientes, proveedores, contactos

```typescript
interface Partner {
  id: number;
  company_id: number;
  name: string;
  email?: string;
  vat?: string;       // Cédula/RUC
  is_company: boolean;
  active: boolean;
}
```

### res_users
Usuarios del sistema

```typescript
interface User {
  id: number;
  email: string;
  partner_id: number;
  company_ids: number[];  // Multiempresa
  active: boolean;
}
```

### product_product / product_template
Productos

```typescript
interface Product {
  id: number;
  name: string;
  code?: string;
  barcode?: string;
  list_price: number;
  active: boolean;
}
```

### uom_uom
Unidades de medida

```typescript
interface UOM {
  id: number;
  name: string;
  factor: number;
  active: boolean;
}
```

## Acceso a datos desde componentes React

```typescript
import { getPartners, getCompany, getProducts } from '@/lib/supabase';

export async function MiComponente() {
  const partners = await getPartners(1); // companyId = 1
  const company = await getCompany(1);
  const products = await getProducts();

  return (
    <div>
      {partners.map(p => <div key={p.id}>{p.name}</div>)}
    </div>
  );
}
```

## Multiempresa (RLS)

El sistema está configurado con Row Level Security (RLS) en Supabase.

- Cada usuario solo ve datos de sus empresas (`company_ids`)
- Filtrado automático en queries
- Seguridad en el nivel de base de datos

## Próximos pasos

1. **Completar CAPA 0:**
   - Crear componentes CRUD para Partners
   - Crear componentes CRUD para Productos
   - Autenticación con Supabase Auth

2. **CAPA 1 (Contabilidad):**
   - Tablas: account, account.journal, account.tax
   - Plan de cuentas ecuatoriano

3. **CAPA 2 (Tributación):**
   - Retenciones
   - Facturación electrónica
   - Integración SRI

4. **IA Integrada:**
   - Claude API para sugerencias contables
   - Automatización de categorizaciones
   - Reportes con análisis

## Stack Tecnológico

- **Frontend:** Next.js 14, React 18, TypeScript
- **Backend:** Supabase (PostgreSQL, Edge Functions)
- **UI:** Tailwind CSS
- **Auth:** Supabase Auth
- **IA:** Anthropic Claude API
- **Deploy:** Vercel (frontend) + Supabase (backend)

## Notas importantes

- ✅ RLS habilitado - multiempresa seguro
- ✅ TypeScript strict mode - type safety
- ✅ Server actions - API routes simplificadas
- ✅ Datos base Ecuador precargados
- ⏳ Autenticación: próxima fase
- ⏳ Componentes UI: próxima fase

## Licencia

GPL-3.0 - Inspirado en Odoo, código personalizado para Ecuador
