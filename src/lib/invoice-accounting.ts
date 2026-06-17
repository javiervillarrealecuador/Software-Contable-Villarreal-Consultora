import { supabase } from '@/lib/supabase';
import { MoveLineInput } from '@/types/capa1';

/**
 * Genera un asiento contable (Move) para una factura de venta (sale_order)
 */
export async function generateSaleAccountingEntry(saleOrderId: number): Promise<number> {
  // 1. Cargar la orden de venta con sus líneas, cliente y productos
  const { data: order, error: orderError } = await supabase
    .from('sale_order')
    .select(`
      *,
      partner:res_partner!sale_order_partner_id_fkey(
        id, name, property_account_receivable_id
      ),
      lines:sale_order_line(
        *,
        product:product_product(
          id,
          template:product_template(
            id, income_account_id
          )
        )
      )
    `)
    .eq('id', saleOrderId)
    .single();

  if (orderError || !order) throw new Error('Error cargando orden de venta: ' + orderError?.message);

  // Validaciones
  if (!order.partner.property_account_receivable_id) {
    throw new Error(`El cliente ${order.partner.name} no tiene configurada una cuenta por cobrar.`);
  }

  // 2. Obtener diario de ventas (por simplicidad buscamos el primer diario de tipo 'sale' de la empresa)
  const { data: journal } = await supabase
    .from('account_journal')
    .select('id, default_account_id')
    .eq('company_id', order.company_id)
    .eq('type', 'sale')
    .limit(1)
    .single();

  if (!journal) {
    throw new Error('No existe un diario de ventas configurado para la empresa.');
  }

  // 3. Crear el asiento contable (Move)
  const { data: move, error: moveError } = await supabase
    .from('account_move')
    .insert({
      company_id: order.company_id,
      journal_id: journal.id,
      move_type: 'out_invoice',
      partner_id: order.partner_id,
      date: order.date_order, // o fecha de emision
      ref: order.invoice_ref || order.name,
      narration: `Venta ${order.invoice_ref || order.name}`,
      state: 'draft',
      amount_untaxed: order.amount_untaxed,
      amount_tax: order.amount_tax,
      amount_total: order.amount_total,
    })
    .select()
    .single();

  if (moveError || !move) throw new Error('Error creando asiento contable: ' + moveError?.message);

  const moveLines: MoveLineInput[] = [];

  // 4. Línea 1: Cuenta por cobrar (Debe) -> Total Factura
  // Si no hubiera retenciones, el Debe es igual al amount_total
  let receivableAmount = order.amount_total;

  // NOTA: Si hubiera retenciones en ventas (Retenciones recibidas), se cargarían aquí y se restaría al receivableAmount.
  // Como simplificación inicial, asumiremos que no hay o se agregan en otro proceso.
  
  moveLines.push({
    account_id: order.partner.property_account_receivable_id,
    partner_id: order.partner_id,
    name: order.name,
    debit: receivableAmount,
    credit: 0
  });

  // 5. Líneas de Ingreso (Haber) -> Agrupadas por cuenta de ingreso del producto
  const incomeGroups: Record<number, number> = {};
  for (const line of order.lines) {
    const incomeAcc = line.product?.template?.income_account_id;
    if (!incomeAcc) {
      throw new Error(`El producto en la línea no tiene configurada una cuenta de ingreso.`);
    }
    incomeGroups[incomeAcc] = (incomeGroups[incomeAcc] || 0) + line.price_subtotal;
  }

  for (const accId in incomeGroups) {
    moveLines.push({
      account_id: parseInt(accId),
      partner_id: order.partner_id,
      name: 'Venta de Bienes/Servicios',
      debit: 0,
      credit: incomeGroups[accId]
    });
  }

  // 6. Línea de IVA Cobrado (Haber)
  if (order.amount_tax > 0) {
    // Buscar cuenta configurada en la empresa (account_sale_tax_id)
    const { data: companyConfig } = await supabase.from('res_company').select('account_sale_tax_id').eq('id', order.company_id).single();
    
    if (!companyConfig || !companyConfig.account_sale_tax_id) {
        throw new Error('No se encontró la cuenta de IVA Ventas. Asegúrate de configurarla en Configuración > Mi Empresa.');
    }

    moveLines.push({
      account_id: companyConfig.account_sale_tax_id,
      partner_id: order.partner_id,
      name: 'IVA Cobrado',
      debit: 0,
      credit: order.amount_tax
    });
  }

  // 7. Insertar Líneas
  const dbLines = moveLines.map(l => ({
    move_id: move.id,
    company_id: order.company_id,
    ...l,
    date: order.date_order
  }));

  const { error: linesError } = await supabase.from('account_move_line').insert(dbLines);
  if (linesError) throw new Error('Error insertando líneas de asiento: ' + linesError.message);

  // 8. Actualizar sale_order con el ID del asiento
  await supabase.from('sale_order').update({ account_move_id: move.id }).eq('id', order.id);

  return move.id;
}
