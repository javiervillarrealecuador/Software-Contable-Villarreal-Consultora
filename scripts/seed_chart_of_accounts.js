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

  // Find asset and liability types
  const assetType = types.find(t => t.internal_group === 'asset') || types[0];
  const liabilityType = types.find(t => t.internal_group === 'liability') || types[0];

  const companyId = 1; // Assuming company 1

  const accounts = [
    { code: '1', name: 'ACTIVO', is_group: true, type: assetType.id },
    { code: '1.1', name: 'ACTIVO CORRIENTE', is_group: true, type: assetType.id, parentCode: '1' },
    { code: '1.1.01', name: 'CAJA', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.02', name: 'BANCOS', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.03', name: 'POR COBRAR CTA PICHINCHA JAVIER VILLARREAL', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.04', name: 'BANCO PROCREDIT 3401011589150', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.05', name: 'CAJA CHEQUES', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.06', name: 'BANCO AUSTRO 4036816', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.07', name: 'BANCO PACIFICO', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.08', name: 'CLIENTES', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.09', name: 'CHEQUES DE CLIENTES POR DEPOSITAR', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.10', name: 'CLIENTES', is_group: false, type: assetType.id, parentCode: '1.1' },
    { code: '1.1.15', name: 'ANTICIPO ENTREGADO EN COMPRAS', is_group: false, type: assetType.id, parentCode: '1.1' },
    
    { code: '1.9', name: 'OTROS ACTIVOS CON EL FISCO', is_group: true, type: assetType.id, parentCode: '1' },
    { code: '1.9.01', name: 'IVA PAGADO/COMPRAS', is_group: false, type: assetType.id, parentCode: '1.9' },
    { code: '1.9.02', name: 'IVA RETENIDO ACTIVO', is_group: false, type: assetType.id, parentCode: '1.9' },
    { code: '1.9.03', name: 'RETENCION IMPUESTO RENTA ACTIVO', is_group: false, type: assetType.id, parentCode: '1.9' },
    
    { code: '2', name: 'PASIVO', is_group: true, type: liabilityType.id },
    { code: '2.1', name: 'PASIVO CORRIENTE', is_group: true, type: liabilityType.id, parentCode: '2' },
    { code: '2.1.01', name: 'CUENTAS POR PAGAR', is_group: true, type: liabilityType.id, parentCode: '2.1' },
    { code: '2.1.01.01', name: 'PROVEEDORES', is_group: true, type: liabilityType.id, parentCode: '2.1.01' },
    { code: '2.1.01.01.01', name: 'PROVEEDORES POR PAGAR', is_group: false, type: liabilityType.id, parentCode: '2.1.01.01' },
  ];

  console.log('Inserting accounts...');
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

    // Try finding it first to handle upsert properly if there's no unique constraint on code, or we just use simple update/insert
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
        if (error) {
            console.error(`Error updating ${acc.code}:`, error.message);
        } else {
            console.log(`Updated: ${acc.code} ${acc.name}`);
        }
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
        if (error) {
            console.error(`Error inserting ${acc.code}:`, error.message);
        } else {
            console.log(`Inserted: ${acc.code} ${acc.name}`);
        }
    }
  }
  console.log('Done!');
}

seed();
