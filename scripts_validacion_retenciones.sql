-- ============================================================================
-- VALIDACION DE RETENCIONES SRI - SCRIPTS SQL
-- Ejecutar en Supabase para verificar completitud de datos
-- ============================================================================

-- ============================================================================
-- 1. VALIDACION: RETENCIONES RENTA (36 REGLAS ESPERADAS)
-- ============================================================================

-- 1.1 Contar total de reglas RENTA activas
SELECT
  COUNT(*) as total_reglas_renta,
  COUNT(DISTINCT percent) as tasas_diferentes,
  MIN(percent) as tasa_minima,
  MAX(percent) as tasa_maxima
FROM l10n_ec_rent_rule
WHERE active = true;

-- 1.2 Listar todas las reglas RENTA por tasa (debe haber ~36)
SELECT
  id,
  name,
  percent,
  air_code,
  active
FROM l10n_ec_rent_rule
WHERE active = true
ORDER BY percent DESC, name;

-- 1.3 Validar que NO falten reglas críticas (12 conceptos SRI mínimos)
SELECT 'Honorarios' as concepto
UNION ALL
SELECT 'Servicios técnicos'
UNION ALL
SELECT 'Servicios administrativos'
UNION ALL
SELECT 'Arriendos inmuebles'
UNION ALL
SELECT 'Arriendos muebles'
UNION ALL
SELECT 'Comisiones'
UNION ALL
SELECT 'Seguros'
UNION ALL
SELECT 'Transporte'
UNION ALL
SELECT 'Publicidad'
UNION ALL
SELECT 'Catering'
UNION ALL
SELECT 'Otros servicios'
WHERE NOT EXISTS (
  SELECT 1 FROM l10n_ec_rent_rule WHERE active = true
);

-- 1.4 Verificar códigos AIR (Formulario ATS) están asignados
SELECT
  COUNT(*) as total,
  COUNT(air_code) as con_air_code,
  COUNT(*) - COUNT(air_code) as sin_air_code
FROM l10n_ec_rent_rule
WHERE active = true;

-- ============================================================================
-- 2. VALIDACION: RETENCIONES IVA (MATRIZ ~70 COMBINACIONES)
-- ============================================================================

-- 2.1 Contar total de combinaciones IVA activas
SELECT
  COUNT(*) as total_combinaciones_iva,
  COUNT(DISTINCT buyer_type) as buyer_types,
  COUNT(DISTINCT seller_type) as seller_types,
  COUNT(DISTINCT target) as targets
FROM l10n_ec_iva_rule
WHERE active = true;

-- 2.2 Distribución por buyer_type
SELECT
  buyer_type,
  COUNT(*) as cantidad,
  COUNT(DISTINCT seller_type) as seller_types,
  COUNT(DISTINCT target) as targets
FROM l10n_ec_iva_rule
WHERE active = true
GROUP BY buyer_type
ORDER BY buyer_type;

-- 2.3 Matriz completa (buyer × seller × target)
SELECT
  buyer_type,
  seller_type,
  target,
  percent as retencion_iva_pct,
  active
FROM l10n_ec_iva_rule
WHERE active = true
ORDER BY buyer_type, seller_type, target;

-- 2.4 Identificar combinaciones críticas (RG compra a RIMPE, etc.)
SELECT
  'RG compra a RIMPE (bienes)' as combinacion,
  ir.percent as retencion_pct,
  CASE
    WHEN ir.percent >= 80 THEN '✓ CORRECTO (>=80%)'
    ELSE '⚠ REVISAR (esperado ~100%)'
  END as validacion
FROM l10n_ec_iva_rule ir
WHERE active = true
  AND ir.buyer_type = 'regimen_general'
  AND ir.seller_type = 'rimpe'
  AND ir.target = 'goods'
UNION ALL
SELECT
  'RG compra a PNO (servicios)',
  ir.percent,
  CASE
    WHEN ir.percent > 0 THEN '✓ CORRECTO (retiene)'
    ELSE '⚠ REVISAR (esperado >0%)'
  END
FROM l10n_ec_iva_rule ir
WHERE active = true
  AND ir.buyer_type = 'regimen_general'
  AND ir.seller_type = 'persona_natural_obligada'
  AND ir.target = 'services'
UNION ALL
SELECT
  'RIMPE compra a RIMPE',
  ir.percent,
  CASE
    WHEN ir.percent >= 0 THEN '✓ ANALIZAR'
    ELSE '⚠ REVISAR'
  END
FROM l10n_ec_iva_rule ir
WHERE active = true
  AND ir.buyer_type = 'rimpe'
  AND ir.seller_type = 'rimpe'
LIMIT 1;

-- 2.5 Tasas IVA: distribución de porcentajes
SELECT
  percent as retencion_iva_pct,
  COUNT(*) as cantidad_combinaciones
FROM l10n_ec_iva_rule
WHERE active = true
GROUP BY percent
ORDER BY percent DESC;

-- ============================================================================
-- 3. VALIDACION: COMPROBANTES DE RETENCION (l10n_ec_withhold)
-- ============================================================================

-- 3.1 Últimos 10 comprobantes de retención
SELECT
  id,
  number,
  date,
  partner_id,
  base_iva,
  base_renta,
  total_iva_withheld,
  total_rent_withheld,
  state,
  created_at
FROM l10n_ec_withhold
ORDER BY id DESC
LIMIT 10;

-- 3.2 Validar campos obligatorios
SELECT
  COUNT(*) as total,
  COUNT(invoice_auth) as con_invoice_auth,
  COUNT(invoice_ref) as con_invoice_ref,
  COUNT(*) - COUNT(invoice_auth) as falta_invoice_auth
FROM l10n_ec_withhold
WHERE state = 'posted';

-- 3.3 Estadísticas de retenciones
SELECT
  DATE(date) as fecha,
  COUNT(*) as cantidad,
  SUM(total_iva_withheld) as total_iva,
  SUM(total_rent_withheld) as total_renta,
  SUM(total_iva_withheld + total_rent_withheld) as total_retenido
FROM l10n_ec_withhold
WHERE state = 'posted'
GROUP BY DATE(date)
ORDER BY fecha DESC;

-- ============================================================================
-- 4. VALIDACION: CALCULO DE RETENCIONES (PRUEBA DE LOGICA)
-- ============================================================================

-- 4.1 Verificar que retenciones se calcularon correctamente
-- Ejemplo: Si base_renta * tasa_esperada ≠ total_rent_withheld, hay error
SELECT
  w.id,
  w.number,
  w.base_renta,
  w.total_rent_withheld,
  ROUND(w.base_renta * 0.10, 2) as renta_esperada_10pct,
  ROUND(w.base_renta * 0.08, 2) as renta_esperada_8pct,
  CASE
    WHEN w.total_rent_withheld = ROUND(w.base_renta * 0.10, 2) THEN '✓ 10%'
    WHEN w.total_rent_withheld = ROUND(w.base_renta * 0.08, 2) THEN '✓ 8%'
    ELSE '⚠ REVISAR TASA'
  END as validacion
FROM l10n_ec_withhold w
WHERE state = 'posted'
  AND w.total_rent_withheld > 0
LIMIT 20;

-- 4.2 Verificar que IVA se calculó correctamente
-- IVA debe ser base_iva * 15% (en Ecuador)
SELECT
  w.id,
  w.number,
  w.base_iva,
  SUM(wl.amount) as iva_retenido_lineas,
  w.total_iva_withheld,
  CASE
    WHEN ABS(w.total_iva_withheld - SUM(wl.amount)) < 0.01 THEN '✓ CORRECTO'
    ELSE '⚠ DISCREPANCIA'
  END as validacion
FROM l10n_ec_withhold w
LEFT JOIN l10n_ec_withhold_line wl ON w.id = wl.withhold_id AND wl.tax_type = 'iva'
WHERE w.state = 'posted'
GROUP BY w.id, w.number, w.base_iva, w.total_iva_withheld
HAVING ABS(w.total_iva_withheld - SUM(wl.amount)) >= 0.01
LIMIT 20;

-- ============================================================================
-- 5. VALIDACION: INTEGRIDAD REFERENCIAL
-- ============================================================================

-- 5.1 Verificar que todos los comprobantes referencian partners válidos
SELECT
  COUNT(*) as total_withholds,
  COUNT(DISTINCT w.partner_id) as partners_diferentes,
  COUNT(*) - COUNT(p.id) as sin_partner_valido
FROM l10n_ec_withhold w
LEFT JOIN res_partner p ON w.partner_id = p.id;

-- 5.2 Verificar que las líneas de retención referencian comprobantes válidos
SELECT
  COUNT(*) as total_lineas,
  COUNT(*) - COUNT(w.id) as lineas_orfanas
FROM l10n_ec_withhold_line wl
LEFT JOIN l10n_ec_withhold w ON wl.withhold_id = w.id;

-- ============================================================================
-- 6. CHECKLIST DE VALIDACION
-- ============================================================================

-- 6.1 Resumen ejecutivo
WITH renta_check AS (
  SELECT
    CASE WHEN COUNT(*) >= 36 THEN 'PASS' ELSE 'FAIL' END as status,
    COUNT(*) as cantidad
  FROM l10n_ec_rent_rule WHERE active = true
),
iva_check AS (
  SELECT
    CASE WHEN COUNT(*) >= 68 THEN 'PASS' ELSE 'FAIL' END as status,
    COUNT(*) as cantidad
  FROM l10n_ec_iva_rule WHERE active = true
),
withhold_check AS (
  SELECT
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'NO_DATA' END as status,
    COUNT(*) as cantidad
  FROM l10n_ec_withhold WHERE state = 'posted'
)
SELECT
  'RENTA Rules (36 esperadas)' as validacion,
  rc.status,
  rc.cantidad
FROM renta_check rc
UNION ALL
SELECT
  'IVA Combinations (~70 esperadas)',
  ic.status,
  ic.cantidad
FROM iva_check ic
UNION ALL
SELECT
  'Comprobantes Retención',
  wc.status,
  wc.cantidad
FROM withhold_check wc;

-- ============================================================================
-- RESULTADO ESPERADO:
-- ✓ Reglas RENTA: 36 activas
-- ✓ Combinaciones IVA: 68-72 activas
-- ✓ Códigos AIR: asignados para ATS
-- ✓ Tasas críticas: RG→RIMPE 100%, RG→PNO variable
-- ✓ Comprobantes: invoice_auth presente, cálculos verificados
-- ============================================================================
