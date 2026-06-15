# ANÁLISIS COMPARATIVO: RETENCIONES SRI vs IMPLEMENTACIÓN ERP

**Fecha:** 2026-06-11  
**Responsable:** Validación contra Normativa SRI (Ecuador)  
**Fuente Normativa:** NAC-DGERCGC26-00000009 + Matriz IVA SRI vigente

---

## 1. RETENCIONES RENTA (36 REGLAS)

### Estructura Implementada en ERP

Tabla: `l10n_ec_rent_rule`

```typescript
interface RentRule {
  id: number;
  name: string;           // descripción del concepto
  percent: number;        // tasa de retención
  air_code?: string;      // código Formulario ATS
  active: boolean;
}
```

### Lógica de Cálculo

```
Retencion RENTA = Base Imponible × (Porcentaje / 100)
```

**Ejemplo:** Pago honorarios $1000 → Retención 10% = $100

---

## 2. REGLAS RENTA ESTÁNDAR SRI

Según tabla oficial **NAC-DGERCGC26-00000009**, las 36 reglas cubren:

| Concepto | Tasa | Código | Justificación |
|----------|------|--------|---------------|
| Honorarios profesionales | 10% | 01 | Art. 91 LRTI |
| Servicios técnicos | 10% | 02 | Art. 91 LRTI |
| Servicios administrativos | 10% | 03 | Art. 91 LRTI |
| Arriendos inmuebles | 8% | 04 | Art. 91 LRTI |
| Arriendos muebles | 8% | 05 | Art. 91 LRTI |
| Comisiones y similares | 10% | 06 | Art. 91 LRTI |
| Seguros | 2% | 07 | Art. 91 LRTI |
| Transporte | 1% | 08 | Art. 91 LRTI |
| Publicidad y comunicación | 1% | 09 | Art. 91 LRTI |
| Contribuciones afiliación | 1% | 10 | Art. 91 LRTI |
| Catering y servicio de alimentos | 1% | 11 | Art. 91 LRTI |
| Otros servicios | 1% | 12 | Art. 91 LRTI |

**TOTAL: 36 reglas** con combinaciones por tipo de beneficiario:
- Persona Natural Obligada (PNO)
- Persona Natural No Obligada (PNNoO)
- Sociedad (REG/RIMPE)
- Institución Pública

---

## 3. RETENCIONES IVA (MATRIZ ~70 COMBINACIONES)

### Estructura Implementada

Tabla: `l10n_ec_iva_rule`

```typescript
interface IvaRule {
  id: number;
  buyer_type: TaxpayerType;    // RG, RIMPE, PNO, etc.
  seller_type: TaxpayerType;
  target: IvaTarget;             // goods, services, prof_fees, etc.
  percent: number;                // tasa retención sobre IVA
  active: boolean;
}
```

### Lógica de Cálculo

```
IVA = Base Imponible × 15%
Retencion IVA = IVA × (Porcentaje / 100)
```

**Ejemplo:** 
- Compra bienes $1000 + IVA 15% ($150)
- Comprador RG, Vendedor PNO
- Matriz indica retención 50% sobre IVA
- Retencion IVA = $150 × 50% = $75

---

## 4. MATRIZ IVA: COMBINACIONES REQUERIDAS

### Tipos de Contribuyentes (Buyer × Seller)

| Buyer | Seller | Combinaciones |
|-------|--------|--------------|
| RG | RG | 4 (goods, services, prof_fees, other) |
| RG | RIMPE | 4 |
| RG | PNO | 4 |
| RG | PNNoO | 4 |
| RIMPE | RG | 4 |
| RIMPE | RIMPE | 4 |
| RIMPE | PNO | 4 |
| RIMPE | PNNoO | 4 |
| PNO | RG | 4 |
| PNO | RIMPE | 4 |
| PNO | PNO | 4 |
| PNO | PNNoO | 4 |
| PNNoO | * | 2 (no retiene para servicios básicos) |

**TOTAL ESPERADO: ~68-72 combinaciones**

---

## 5. CAMPOS CRÍTICOS POR TIPO DE COMPROBANTE

### Comprobante de Retención (l10n_ec_withhold)

```sql
CREATE TABLE l10n_ec_withhold (
  id BIGINT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  partner_id BIGINT NOT NULL,
  number VARCHAR(20),              -- RET-000001
  date DATE,
  invoice_ref VARCHAR(20),         -- referencia factura original
  invoice_auth VARCHAR(49),        -- número autorización SRI
  invoice_date DATE,
  
  -- Bases y totales
  base_iva DECIMAL(12,2),          -- sumatoria IVA base
  base_renta DECIMAL(12,2),        -- sumatoria RENTA base
  total_iva_withheld DECIMAL(12,2),
  total_rent_withheld DECIMAL(12,2),
  
  state VARCHAR(20),               -- draft, posted, cancelled
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**VALIDACIÓN REQUERIDA:**
- ✅ Campo `invoice_auth`: obligatorio para SRI (formato 49 caracteres)
- ✅ Campo `number`: secuencial por empresa (RET-000001)
- ✅ Separación bases: IVA y RENTA por concepto
- ✅ Estados: draft → posted (auditoría)

---

## 6. COMPARATIVA: NUESTRO CÓDIGO vs ODOO ESTÁNDAR

### Motor de Cálculo (src/lib/withholding.ts)

```typescript
// NUESTRO CÓDIGO - LÍNEA 90-119
export function calcWithhold(
  input: WithholdCalcInput,
  ivaRules: IvaRule[],
  rentRules: RentRule[]
): WithholdCalcResult {
  const base = input.base_imponible;
  const ivaAmount = base * (input.iva_rate / 100);
  
  // Búsqueda exacta IVA
  const ivaPct = findIvaPercent(ivaRules, input.buyer_type, input.seller_type, input.target);
  const ivaWithheld = ivaAmount * (ivaPct / 100);
  
  // Búsqueda RENTA
  const rentRule = rentRules.find(r => r.id === input.rent_rule_id);
  const rentPct = rentRule ? Number(rentRule.percent) : 0;
  const rentWithheld = base * (rentPct / 100);
  
  return {
    iva_amount: ivaAmount,
    iva_withhold_percent: ivaPct,
    iva_withhold_amount: ivaWithheld,
    rent_withhold_percent: rentPct,
    rent_withhold_amount: rentWithheld,
    total_withheld: ivaWithheld + rentWithheld,
    net_payable: base + ivaAmount - (ivaWithheld + rentWithheld)
  };
}
```

### Estándar Odoo (teórico)

Odoo separa la lógica en:
1. **Modelo `l10n.ec.rent.rule`** → datos maestros
2. **Modelo `l10n.ec.iva.rule`** → datos maestros
3. **Modelo `l10n.ec.withhold`** → comprobante
4. **Modelo `l10n.ec.withhold.line`** → líneas detalladas

**Diferencias encontradas:**
- ✅ Ambas: búsqueda exacta en matriz IVA
- ✅ Ambas: cálculo sobre base para RENTA, sobre IVA para IVA
- ⚠️ Odoo: manejo adicional de "casos especiales" (professional_fees, rent_property)
- ⚠️ Nuestro: fallback a búsqueda parcial si no hay exacta (línea 76-78)

---

## 7. VALIDACIÓN ACTUAL: COMPLETITUD

### ✅ IMPLEMENTADO CORRECTAMENTE

1. **Separación RENTA vs IVA**
   - Base para RENTA = imponible completo
   - Base para IVA = calculado como imponible × 15%
   
2. **Matriz paramétrica**
   - 3 dimensiones: buyer_type, seller_type, target
   - Fallback: búsqueda parcial para casos especiales
   
3. **Comprobante de retención**
   - Numeración secuencial por empresa
   - Estados: draft → posted
   - Auditoria: created_at, updated_at

4. **Integración ATS**
   - Campo `invoice_auth` incluido
   - Código conceptual en tabla `l10n_ec_rent_rule.air_code`

### ⚠️ VALIDAR ANTES DE PRODUCCIÓN

1. **¿Están cargadas las 36 reglas RENTA?**
   - Verificar en BD: `SELECT COUNT(*) FROM l10n_ec_rent_rule WHERE active=true`
   - Esperado: ~36 registros
   - Requiere: name, percent, air_code (para ATS)

2. **¿Está la matriz IVA completa (~70 combos)?**
   - Verificar en BD: `SELECT COUNT(*) FROM l10n_ec_iva_rule WHERE active=true`
   - Esperado: 68-72 registros
   - Requiere: buyer_type, seller_type, target (3 columnas clave)

3. **Tasas porcentuales IVA**
   - Combinaciones críticas:
     - RG compra a RIMPE (bienes): 100% retención
     - RG compra a PNO (servicios): variable 30-100%
     - RIMPE compra a PNNoO: típicamente 0%

4. **Prueba end-to-end**
   - Crear compra $1000 (RENTA Honorarios 10% + IVA 15%)
   - Esperado neto: $1000 + $150 - $100 - $150 = $900
   - Verificar asiento contable correcto

---

## 8. RECOMENDACIONES

### Inmediatas

1. **Validar carga inicial de datos**
   ```sql
   -- Verificar RENTA rules
   SELECT name, percent, air_code FROM l10n_ec_rent_rule 
   WHERE active=true ORDER BY percent DESC;
   
   -- Verificar IVA rules
   SELECT buyer_type, seller_type, target, percent 
   FROM l10n_ec_iva_rule WHERE active=true 
   ORDER BY buyer_type, seller_type;
   ```

2. **Test caso de uso**
   - Crear factura de compra con retención automática
   - Validar que el cálculo coincida con ejemplo SRI
   - Exportar ATS y verificar formato XML

3. **Documentación**
   - Crear tabla mapping: Código SRI → `air_code` en BD
   - Documentar excepciones (ej: servicios básicos no se retienen)

### Mediano Plazo

1. **Interfaz de gestión de retenciones**
   - Página de edición de tasas (por ahora están hardcodeadas en SQL)
   - Validación: no permitir porcentajes > 100%
   - Auditoría: qué usuario cambió qué regla

2. **Casos especiales**
   - Importadores (retención adicional)
   - Contratistas construcción (retención especial)
   - Servicios financieros (según ACU)

---

## 9. CONCLUSIÓN

**Estado:** ✅ ESTRUCTURA CORRECTA, PENDIENTE VALIDACIÓN DE DATOS

El motor de cálculo sigue correctamente la normativa SRI:
- Retenciones RENTA sobre base imponible ✅
- Retenciones IVA sobre el IVA calculado ✅
- Matriz tridimensional para IVA ✅
- Separación en comprobante de retención ✅

**Bloqueante:** Verificar que todas las 36 reglas RENTA + ~70 combos IVA estén cargados en Supabase con tasas correctas.

**Próximo paso:** Ejecutar validación SQL y prueba end-to-end antes de Capa 4 (Ventas).

---

*Generado automáticamente - Archivo de referencia técnica*
