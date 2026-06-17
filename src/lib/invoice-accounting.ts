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
  
  if (order.account_move_id) {
    throw new Error(`La factura ${order.name} ya tiene un asiento contable asociado (MOVE-${order.account_move_id}).`);
  }

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

export async function generateSalesBatchAccountingEntry(
  companyId: number,
  saleOrderIds: number[],
  startDate: string,
  endDate: string
): Promise<number> {
  const { data: orders, error: orderError } = await supabase
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
    .in('id', saleOrderIds);

  if (orderError || !orders || orders.length === 0) {
    throw new Error('Error cargando órdenes de venta o lista vacía.');
  }

  const alreadyPosted = orders.filter(o => o.account_move_id);
  if (alreadyPosted.length > 0) {
    throw new Error(`Las siguientes facturas ya están contabilizadas: ${alreadyPosted.map(o => o.name).join(', ')}`);
  }

  const { data: journal } = await supabase
    .from('account_journal')
    .select('id, default_account_id')
    .eq('company_id', companyId)
    .eq('type', 'sale')
    .limit(1)
    .single();

  if (!journal) {
    throw new Error('No existe un diario de ventas configurado para la empresa.');
  }

  const debitLinesMap: Record<number, { debit: number; credit: number; name: string }> = {};
  const creditLinesMap: Record<number, { debit: number; credit: number; name: string }> = {};

  let totalAmount = 0;
  let totalTax = 0;
  let totalUntaxed = 0;

  for (const order of orders) {
    totalAmount += Number(order.amount_total);
    totalTax += Number(order.amount_tax);
    totalUntaxed += Number(order.amount_untaxed);

    const recAccId = order.partner.property_account_receivable_id;
    if (!recAccId) {
      throw new Error(`El cliente ${order.partner.name} no tiene configurada una cuenta por cobrar.`);
    }

    if (!debitLinesMap[recAccId]) {
      debitLinesMap[recAccId] = { debit: 0, credit: 0, name: 'Cuentas por Cobrar Clientes (Lote)' };
    }
    debitLinesMap[recAccId].debit += Number(order.amount_total);

    for (const line of order.lines) {
      const incomeAcc = line.product?.template?.income_account_id;
      if (!incomeAcc) {
        throw new Error(`El producto en la factura ${order.name} no tiene configurada una cuenta de ingreso.`);
      }

      if (!creditLinesMap[incomeAcc]) {
        creditLinesMap[incomeAcc] = { debit: 0, credit: 0, name: 'Ventas de Bienes/Servicios (Lote)' };
      }
      creditLinesMap[incomeAcc].credit += Number(line.price_subtotal);
    }

    if (order.amount_tax > 0) {
      const { data: companyConfig } = await supabase
        .from('res_company')
        .select('account_sale_tax_id')
        .eq('id', companyId)
        .single();

      if (!companyConfig || !companyConfig.account_sale_tax_id) {
        throw new Error('No se encontró la cuenta de IVA Ventas. Asegúrate de configurarla en Configuración > Mi Empresa.');
      }
      const taxAccId = companyConfig.account_sale_tax_id;

      if (!creditLinesMap[taxAccId]) {
        creditLinesMap[taxAccId] = { debit: 0, credit: 0, name: 'IVA Cobrado (Lote)' };
      }
      creditLinesMap[taxAccId].credit += Number(order.amount_tax);
    }
  }

  const { data: journalFull } = await supabase
    .from('account_journal')
    .select('*')
    .eq('id', journal.id)
    .single();

  const moveName = `${journalFull.sequence_prefix || journalFull.code + '/'}${String(journalFull.sequence_number).padStart(4, '0')}`;

  const { data: move, error: moveError } = await supabase
    .from('account_move')
    .insert({
      company_id: companyId,
      journal_id: journal.id,
      name: moveName,
      move_type: 'entry',
      date: endDate,
      ref: `LOTE VENTAS ${startDate} a ${endDate}`,
      narration: `Contabilización masiva de ventas del ${startDate} al ${endDate} (${orders.length} documentos)`,
      state: 'draft',
      amount_untaxed: Math.round(totalUntaxed * 100) / 100,
      amount_tax: Math.round(totalTax * 100) / 100,
      amount_total: Math.round(totalAmount * 100) / 100,
    })
    .select()
    .single();

  if (moveError || !move) throw new Error('Error creando asiento contable lote: ' + moveError?.message);

  const finalLines = [];

  for (const accId in debitLinesMap) {
    finalLines.push({
      move_id: move.id,
      company_id: companyId,
      account_id: parseInt(accId),
      name: debitLinesMap[accId].name,
      debit: Math.round(debitLinesMap[accId].debit * 100) / 100,
      credit: 0,
      date: endDate,
    });
  }

  for (const accId in creditLinesMap) {
    finalLines.push({
      move_id: move.id,
      company_id: companyId,
      account_id: parseInt(accId),
      name: creditLinesMap[accId].name,
      debit: 0,
      credit: Math.round(creditLinesMap[accId].credit * 100) / 100,
      date: endDate,
    });
  }

  const { error: linesError } = await supabase.from('account_move_line').insert(finalLines);
  if (linesError) {
    await supabase.from('account_move').delete().eq('id', move.id);
    throw new Error('Error insertando líneas de asiento lote: ' + linesError.message);
  }

  await supabase
    .from('account_journal')
    .update({ sequence_number: journalFull.sequence_number + 1 })
    .eq('id', journal.id);

  const { error: updateError } = await supabase
    .from('sale_order')
    .update({ account_move_id: move.id })
    .in('id', saleOrderIds);

  if (updateError) {
    throw new Error('Error asociando asiento contable a las facturas: ' + updateError.message);
  }

  return move.id;
}
