// src/lib/inventory.ts

import { supabase } from './supabase';

// --- Productos (lista plana para selects) ---

export async function getProducts() {
  const { data, error } = await supabase
    .from('product_product')
    .select('id, code, template:product_template(id, name, type, standard_price, list_price, uom_id)')
    .eq('active', true)
    .order('id');
  if (error) throw error;
  // Aplanar para compatibilidad con selects en paginas
  return (data || []).map((p: any) => ({
    id: p.id,
    code: p.code,
    name: p.template?.name || '',
    type: p.template?.type || 'product',
    standard_price: p.template?.standard_price || 0,
    list_price: p.template?.list_price || 0,
    uom_id: p.template?.uom_id,
  }));
}

// --- Ubicaciones ---

export async function getLocations() {
  const { data, error } = await supabase
    .from('stock_location')
    .select('id, name, usage')
    .eq('active', true)
    .order('id');
  if (error) throw error;
  return data || [];
}

// --- Stock actual (stock_quant) ---

export async function getStock(companyId = 1) {
  const { data, error } = await supabase
    .from('stock_quant')
    .select(''
      + 'id, product_id, quantity, avg_cost,'
      + 'location:stock_location(id, name, usage),'
      + 'product:product_product(id, code, template:product_template(name, uom_id))'
    )
    .eq('company_id', companyId)
    .gt('quantity', 0);
  if (error) throw error;
  return (data || []).map((q: any) => ({
    ...q,
    product: q.product
      ? { ...q.product, name: q.product.template?.name || '' }
      : null,
  }));
}

// --- Kardex por producto ---

export async function getKardex(productId: number, companyId = 1) {
  const { data, error } = await supabase
    .from('stock_move')
    .select('id, date, reference, move_type, quantity, unit_cost, total_cost, balance_qty, balance_avg_cost, balance_total')
    .eq('product_id', productId)
    .eq('company_id', companyId)
    .order('date', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

// --- Motor de promedio ponderado ---

function calcWeightedAvg(currentQty: number, currentAvg: number, inQty: number, inCost: number) {
  const total = currentQty + inQty;
  if (total === 0) return 0;
  return (currentQty * currentAvg + inQty * inCost) / total;
}

// --- Registrar movimiento (entrada/salida/ajuste) ---

export interface RegisterMoveInput {
  company_id: number;
  product_id: number;
  move_type: 'in' | 'out';
  quantity: number;
  unit_cost?: number;
  date: string;
  reference?: string;
  location_internal_id: number;
  location_virtual_id: number;
}

export async function registerMove(input: RegisterMoveInput): Promise<void> {
  // Obtener stock actual
  const { data: quant } = await supabase
    .from('stock_quant')
    .select('quantity, avg_cost')
    .eq('product_id', input.product_id)
    .eq('company_id', input.company_id)
    .eq('location_id', input.location_internal_id)
    .single();

  const currentQty = quant?.quantity ?? 0;
  const currentAvg = quant?.avg_cost ?? 0;

  let newQty: number;
  let newAvg: number;
  const unitCost = input.unit_cost ?? currentAvg;
  const totalCost = input.quantity * unitCost;

  if (input.move_type === 'in') {
    newAvg = calcWeightedAvg(currentQty, currentAvg, input.quantity, unitCost);
    newQty = currentQty + input.quantity;
  } else {
    if (currentQty < input.quantity) throw new Error('Stock insuficiente');
    newQty = currentQty - input.quantity;
    newAvg = currentAvg; // El promedio no cambia en salidas
  }

  // Upsert stock_quant
  const { error: quantError } = await supabase
    .from('stock_quant')
    .upsert({
      product_id: input.product_id,
      company_id: input.company_id,
      location_id: input.location_internal_id,
      quantity: newQty,
      avg_cost: newAvg,
    }, { onConflict: 'product_id,company_id,location_id' });
  if (quantError) throw quantError;

  // Actualizar standard_price en template
  const { data: prod } = await supabase
    .from('product_product')
    .select('product_tmpl_id')
    .eq('id', input.product_id)
    .single();
  if (prod && input.move_type === 'in') {
    await supabase
      .from('product_template')
      .update({ standard_price: newAvg })
      .eq('id', prod.product_tmpl_id);
  }

  // Insertar en stock_move con saldos (Kardex)
  const { error: moveError } = await supabase
    .from('stock_move')
    .insert([{
      company_id: input.company_id,
      product_id: input.product_id,
      move_type: input.move_type,
      quantity: input.quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      balance_qty: newQty,
      balance_avg_cost: newAvg,
      balance_total: newQty * newAvg,
      date: input.date,
      reference: input.reference || null,
      location_internal_id: input.location_internal_id,
      location_virtual_id: input.location_virtual_id,
    }]);
  if (moveError) throw moveError;
}
