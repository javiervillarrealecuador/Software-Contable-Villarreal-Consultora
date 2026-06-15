-- =============================================================================
-- 020_limpieza_datos_prueba.sql
-- LIMPIEZA DE DATOS DE PRUEBA — deja la base lista para operación real.
--
-- ⚠️  DESTRUCTIVO E IRREVERSIBLE para los datos transaccionales.
--     Ejecutar SOLO cuando confirmes que no necesitas las pruebas.
--
-- SE BORRA (transaccional):
--   asientos contables, ventas, compras, Kardex, existencias, retenciones.
-- SE CONSERVA (configuración):
--   empresa (RUC + configuración SRI), plan de cuentas (incluida 4.03.01),
--   diarios, reglas de retención renta/IVA, ubicaciones, unidades de medida.
-- OPCIONAL (sección al final): partner y producto demo.
--
-- Los comprobantes autorizados en el AMBIENTE DE PRUEBAS del SRI no se
-- pueden "borrar" del SRI, pero no tienen ninguna validez tributaria.
-- =============================================================================

BEGIN;

-- ── 1. Contabilidad (líneas → cabeceras) ──
DELETE FROM public.account_move_line;
DELETE FROM public.account_move;

-- Reiniciar secuencias de los diarios
UPDATE public.account_journal SET sequence_number = 1;

-- ── 2. Ventas (líneas → cabeceras) ──
DELETE FROM public.sale_order_line;
DELETE FROM public.sale_order;

-- ── 3. Compras ──
DELETE FROM public.purchase_order_line;
DELETE FROM public.purchase_order;

-- ── 4. Inventario (Kardex y existencias) ──
DELETE FROM public.stock_move;
DELETE FROM public.stock_quant;

-- ── 5. Retenciones ──
DELETE FROM public.l10n_ec_withhold_line;
DELETE FROM public.l10n_ec_withhold;

-- ── 6. Reiniciar las secuencias de IDs (los próximos documentos parten de 1) ──
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'account_move','account_move_line','sale_order','sale_order_line',
        'purchase_order','purchase_order_line','stock_move','stock_quant',
        'l10n_ec_withhold','l10n_ec_withhold_line'
    ]
    LOOP
        EXECUTE format('ALTER SEQUENCE IF EXISTS %I_id_seq RESTART WITH 1', t);
    END LOOP;
END $$;

-- ── 7. OPCIONAL: partner y producto demo ──
-- Si quieres conservarlos para seguir probando, comenta estas 4 líneas.
DELETE FROM public.res_partner WHERE vat = '0401200241' AND name = 'Juan Perez Consultor';
DELETE FROM public.product_product WHERE code = 'PROD-00001';
DELETE FROM public.product_template WHERE name = 'Cemento 50kg';

COMMIT;

-- ── Verificación ──
SELECT 'account_move' AS tabla, COUNT(*) AS filas FROM public.account_move
UNION ALL SELECT 'sale_order', COUNT(*) FROM public.sale_order
UNION ALL SELECT 'purchase_order', COUNT(*) FROM public.purchase_order
UNION ALL SELECT 'stock_move', COUNT(*) FROM public.stock_move
UNION ALL SELECT 'stock_quant', COUNT(*) FROM public.stock_quant
UNION ALL SELECT 'l10n_ec_withhold', COUNT(*) FROM public.l10n_ec_withhold
UNION ALL SELECT 'res_partner (conservados)', COUNT(*) FROM public.res_partner
UNION ALL SELECT 'account_account (conservadas)', COUNT(*) FROM public.account_account
UNION ALL SELECT 'l10n_ec_rent_rule (conservadas)', COUNT(*) FROM public.l10n_ec_rent_rule;
