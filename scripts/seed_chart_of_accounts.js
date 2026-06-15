const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Fetching existing account types...');
  const { data: types, error: typeError } = await supabase.from('account_account_type').select('*');
  
  if (typeError) {
    console.error('Error fetching types:', typeError);
    return;
  }

  // Find types by internal_group
  const getType = (group) => types.find(t => t.internal_group === group)?.id || types[0]?.id;
  
  const typeAsset = getType('asset');
  const typeLiability = getType('liability');
  const typeEquity = getType('equity');
  const typeIncome = getType('income');
  const typeExpense = getType('expense');

  const companyId = 1;

  const accounts = [
    // 1. ACTIVO (Some were already inserted, but we use UPSERT logic so it's safe to include or omit the previously inserted ones. Let's include the new ones)
    { code: '1.1.11', name: 'INVENTARIO DE MERCADERIA', is_group: false, type: typeAsset, parentCode: '1.1' },
    { code: '1.1.12', name: 'MATERIA PRIMA Y SUMINISTROS', is_group: false, type: typeAsset, parentCode: '1.1' },
    { code: '1.1.13', name: 'SEGUROS PAGADOS POR ANTICIPADO', is_group: false, type: typeAsset, parentCode: '1.1' },
    { code: '1.1.14', name: 'ARRIENDOS PAGADOS POR ANTICIPADO', is_group: false, type: typeAsset, parentCode: '1.1' },

    { code: '1.2', name: 'ACTIVO NO CORRIENTE', is_group: true, type: typeAsset, parentCode: '1' },
    { code: '1.2.01', name: 'TERRENOS', is_group: false, type: typeAsset, parentCode: '1.2' },
    { code: '1.2.02', name: 'EDIFICIOS E INSTALACIONES', is_group: false, type: typeAsset, parentCode: '1.2' },
    { code: '1.2.03', name: 'MUEBLES Y ENSERES', is_group: false, type: typeAsset, parentCode: '1.2' },
    { code: '1.2.04', name: 'MAQUINARIA Y EQUIPO', is_group: false, type: typeAsset, parentCode: '1.2' },
    { code: '1.2.05', name: 'VEHICULOS', is_group: false, type: typeAsset, parentCode: '1.2' },
    { code: '1.2.06', name: 'EQUIPO DE COMPUTACION Y SOFTWARE', is_group: false, type: typeAsset, parentCode: '1.2' },
    { code: '1.2.07', name: '(-) DEPRECIACION ACUMULADA DE ACTIVOS FIJOS', is_group: false, type: typeAsset, parentCode: '1.2' },
    { code: '1.2.08', name: 'ACTIVOS INTANGIBLES', is_group: false, type: typeAsset, parentCode: '1.2' },
    { code: '1.2.09', name: '(-) AMORTIZACION ACUMULADA DE INTANGIBLES', is_group: false, type: typeAsset, parentCode: '1.2' },

    // 2. PASIVO
    { code: '2.1.02', name: 'OBLIGACIONES CON INSTITUCIONES FINANCIERAS', is_group: false, type: typeLiability, parentCode: '2.1' },
    { code: '2.1.03', name: 'ANTICIPO DE CLIENTES', is_group: false, type: typeLiability, parentCode: '2.1' },
    
    { code: '2.1.04', name: 'OBLIGACIONES CON EL IESS', is_group: true, type: typeLiability, parentCode: '2.1' },
    { code: '2.1.04.01', name: 'APORTE PATRONAL POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.04' },
    { code: '2.1.04.02', name: 'APORTE PERSONAL POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.04' },
    { code: '2.1.04.03', name: 'PRESTAMOS IESS POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.04' },
    { code: '2.1.04.04', name: 'FONDOS DE RESERVA POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.04' },

    { code: '2.1.05', name: 'OBLIGACIONES CON EMPLEADOS', is_group: true, type: typeLiability, parentCode: '2.1' },
    { code: '2.1.05.01', name: 'SUELDOS Y SALARIOS POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.05' },
    { code: '2.1.05.02', name: 'DECIMO TERCER SUELDO POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.05' },
    { code: '2.1.05.03', name: 'DECIMO CUARTO SUELDO POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.05' },
    { code: '2.1.05.04', name: 'VACACIONES POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.05' },
    { code: '2.1.05.05', name: 'PARTICIPACION A TRABAJADORES POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.05' },

    { code: '2.1.06', name: 'OBLIGACIONES CON EL SRI', is_group: true, type: typeLiability, parentCode: '2.1' },
    { code: '2.1.06.01', name: 'IVA COBRADO / VENTAS', is_group: false, type: typeLiability, parentCode: '2.1.06' },
    { code: '2.1.06.02', name: 'RETENCIONES IR POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.06' },
    { code: '2.1.06.03', name: 'RETENCIONES IVA POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.06' },
    { code: '2.1.06.04', name: 'IMPUESTO A LA RENTA POR PAGAR', is_group: false, type: typeLiability, parentCode: '2.1.06' },

    { code: '2.2', name: 'PASIVO NO CORRIENTE', is_group: true, type: typeLiability, parentCode: '2' },
    { code: '2.2.01', name: 'PRESTAMOS BANCARIOS A LARGO PLAZO', is_group: false, type: typeLiability, parentCode: '2.2' },
    { code: '2.2.02', name: 'PROVISION PARA JUBILACION PATRONAL', is_group: false, type: typeLiability, parentCode: '2.2' },
    { code: '2.2.03', name: 'PROVISION PARA DESAHUCIO', is_group: false, type: typeLiability, parentCode: '2.2' },

    // 3. PATRIMONIO
    { code: '3', name: 'PATRIMONIO', is_group: true, type: typeEquity, parentCode: null },
    { code: '3.1', name: 'CAPITAL SUSCRITO', is_group: false, type: typeEquity, parentCode: '3' },
    { code: '3.2', name: 'APORTES PARA FUTURA CAPITALIZACION', is_group: false, type: typeEquity, parentCode: '3' },
    { code: '3.3', name: 'RESERVA LEGAL', is_group: false, type: typeEquity, parentCode: '3' },
    { code: '3.4', name: 'RESERVA FACULTATIVA / ESTATUTARIA', is_group: false, type: typeEquity, parentCode: '3' },
    { code: '3.5', name: 'RESULTADOS ACUMULADOS', is_group: false, type: typeEquity, parentCode: '3' },
    { code: '3.6', name: 'PERDIDAS ACUMULADAS', is_group: false, type: typeEquity, parentCode: '3' },
    { code: '3.7', name: 'UTILIDAD DEL EJERCICIO', is_group: false, type: typeEquity, parentCode: '3' },
    { code: '3.8', name: '(-) PERDIDA DEL EJERCICIO', is_group: false, type: typeEquity, parentCode: '3' },

    // 4. INGRESOS
    { code: '4', name: 'INGRESOS', is_group: true, type: typeIncome, parentCode: null },
    { code: '4.1', name: 'INGRESOS ORDINARIOS', is_group: true, type: typeIncome, parentCode: '4' },
    { code: '4.1.01', name: 'VENTAS DE MERCADERIAS 15%', is_group: false, type: typeIncome, parentCode: '4.1' },
    { code: '4.1.02', name: 'VENTAS DE MERCADERIAS 0%', is_group: false, type: typeIncome, parentCode: '4.1' },
    { code: '4.1.03', name: 'INGRESOS POR SERVICIOS', is_group: false, type: typeIncome, parentCode: '4.1' },
    { code: '4.1.04', name: '(-) DEVOLUCION EN VENTAS', is_group: false, type: typeIncome, parentCode: '4.1' },
    { code: '4.1.05', name: '(-) DESCUENTO EN VENTAS', is_group: false, type: typeIncome, parentCode: '4.1' },

    { code: '4.2', name: 'OTROS INGRESOS', is_group: true, type: typeIncome, parentCode: '4' },
    { code: '4.2.01', name: 'INTERESES GANADOS', is_group: false, type: typeIncome, parentCode: '4.2' },
    { code: '4.2.02', name: 'GANANCIA EN VENTA DE ACTIVOS', is_group: false, type: typeIncome, parentCode: '4.2' },
    { code: '4.2.03', name: 'OTROS INGRESOS VARIOS', is_group: false, type: typeIncome, parentCode: '4.2' },

    // 5. COSTOS Y GASTOS
    { code: '5', name: 'COSTOS Y GASTOS', is_group: true, type: typeExpense, parentCode: null },
    { code: '5.1', name: 'COSTO DE VENTAS', is_group: true, type: typeExpense, parentCode: '5' },
    { code: '5.1.01', name: 'COSTO DE VENTA DE MERCADERIAS', is_group: false, type: typeExpense, parentCode: '5.1' },
    { code: '5.1.02', name: 'COSTO DE MATERIA PRIMA', is_group: false, type: typeExpense, parentCode: '5.1' },

    { code: '5.2', name: 'GASTOS DE ADMINISTRACION Y VENTAS', is_group: true, type: typeExpense, parentCode: '5' },
    { code: '5.2.01', name: 'GASTOS DE PERSONAL', is_group: true, type: typeExpense, parentCode: '5.2' },
    { code: '5.2.01.01', name: 'SUELDOS Y SALARIOS', is_group: false, type: typeExpense, parentCode: '5.2.01' },
    { code: '5.2.01.02', name: 'BENEFICIOS SOCIALES', is_group: false, type: typeExpense, parentCode: '5.2.01' },
    { code: '5.2.01.03', name: 'APORTE PATRONAL IESS', is_group: false, type: typeExpense, parentCode: '5.2.01' },
    { code: '5.2.01.04', name: 'CAPACITACION AL PERSONAL', is_group: false, type: typeExpense, parentCode: '5.2.01' },

    { code: '5.2.02', name: 'GASTOS GENERALES', is_group: true, type: typeExpense, parentCode: '5.2' },
    { code: '5.2.02.01', name: 'HONORARIOS PROFESIONALES', is_group: false, type: typeExpense, parentCode: '5.2.02' },
    { code: '5.2.02.02', name: 'SERVICIOS BASICOS', is_group: false, type: typeExpense, parentCode: '5.2.02' },
    { code: '5.2.02.03', name: 'ARRIENDOS', is_group: false, type: typeExpense, parentCode: '5.2.02' },
    { code: '5.2.02.04', name: 'MANTENIMIENTO Y REPARACIONES', is_group: false, type: typeExpense, parentCode: '5.2.02' },
    { code: '5.2.02.05', name: 'PUBLICIDAD Y MERCADEO', is_group: false, type: typeExpense, parentCode: '5.2.02' },
    { code: '5.2.02.06', name: 'SUMINISTROS DE OFICINA', is_group: false, type: typeExpense, parentCode: '5.2.02' },
    { code: '5.2.02.07', name: 'SEGUROS', is_group: false, type: typeExpense, parentCode: '5.2.02' },
    { code: '5.2.02.08', name: 'VIATICOS Y MOVILIZACION', is_group: false, type: typeExpense, parentCode: '5.2.02' },

    { code: '5.3', name: 'GASTOS NO DEDUCIBLES Y FINANCIEROS', is_group: true, type: typeExpense, parentCode: '5' },
    { code: '5.3.01', name: 'DEPRECIACION DE ACTIVOS FIJOS', is_group: false, type: typeExpense, parentCode: '5.3' },
    { code: '5.3.02', name: 'AMORTIZACION DE INTANGIBLES', is_group: false, type: typeExpense, parentCode: '5.3' },
    { code: '5.3.03', name: 'INTERESES Y COMISIONES BANCARIAS', is_group: false, type: typeExpense, parentCode: '5.3' },
    { code: '5.3.04', name: 'MULTAS E INTERESES', is_group: false, type: typeExpense, parentCode: '5.3' },
    { code: '5.3.05', name: 'GASTOS NO DEDUCIBLES', is_group: false, type: typeExpense, parentCode: '5.3' },
  ];

  console.log('Inserting full catalog...');
  for (const acc of accounts) {
    let parent_id = null;
    if (acc.parentCode) {
      const { data: parentData } = await supabase
        .from('account_account')
        .select('id')
        .eq('company_id', companyId)
        .eq('code', acc.parentCode)
        .single();
      
      if (parentData) {
        parent_id = parentData.id;
      }
    }

    const { data: existing } = await supabase
        .from('account_account')
        .select('id')
        .eq('company_id', companyId)
        .eq('code', acc.code)
        .single();

    if (existing) {
        const { error } = await supabase
            .from('account_account')
            .update({
                name: acc.name,
                account_type_id: acc.type,
                parent_id: parent_id,
                is_group: acc.is_group,
                reconcile: !acc.is_group,
                active: true,
            })
            .eq('id', existing.id);
        if (error) console.error(`Error updating ${acc.code}:`, error.message);
        else console.log(`Updated: ${acc.code} ${acc.name}`);
    } else {
        const { error } = await supabase
            .from('account_account')
            .insert({
                company_id: companyId,
                code: acc.code,
                name: acc.name,
                account_type_id: acc.type,
                parent_id: parent_id,
                is_group: acc.is_group,
                reconcile: !acc.is_group,
                active: true,
            });
        if (error) console.error(`Error inserting ${acc.code}:`, error.message);
        else console.log(`Inserted: ${acc.code} ${acc.name}`);
    }
  }
  console.log('Done full catalog!');
}

seed();
