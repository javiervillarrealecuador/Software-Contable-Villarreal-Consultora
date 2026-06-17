import { supabase } from '@/lib/supabase';
import { MoveLineInput } from '@/types/capa1';

/**
 * Genera un asiento contable (Move) para una retención recibida de un cliente.
 */
export async function generateReceivedWithholdingEntry(withholdingId: number): Promise<number> {
  // 1. Cargar la retención con datos del cliente y configuración de empresa
  const { data: withholding, error: whError } = await supabase
    .from('sale_received_withholding')
    .select(`
      *,
      partner:res_partner!sale_received_withholding_partner_id_fkey(
        id, name, property_account_receivable_id
      ),
      company:res_company!sale_received_withholding_company_id_fkey(
        account_withholding_rent_id, account_withholding_iva_id
      ),
      sale:sale_order!sale_received_withholding_sale_order_id_fkey(
        name, invoice_ref
      )
    `)
    .eq('id', withholdingId)
    .single();

  if (whError || !withholding) throw new Error('Error cargando retención recibida: ' + whError?.message);

  if (withholding.account_move_id) {
    throw new Error('Esta retención ya está contabilizada.');
  }

  // Validaciones
  if (!withholding.partner.property_account_receivable_id) {
    throw new Error(`El cliente ${withholding.partner.name} no tiene configurada una cuenta por cobrar.`);
  }

  const { account_withholding_rent_id, account_withholding_iva_id } = withholding.company;
  if (!account_withholding_rent_id || !account_withholding_iva_id) {
    throw new Error('No se han configurado las cuentas de retenciones (Renta e IVA) en la Empresa.');
  }

  // 2. Obtener un diario de tipo diverso (general) o ventas
  // Generalmente las retenciones recibidas pueden ir en el diario de ventas o en uno de caja/bancos o varios. Usaremos el de ventas o general.
  const { data: journal } = await supabase
    .from('account_journal')
    .select('id, default_account_id')
    .eq('company_id', withholding.company_id)
    .in('type', ['sale', 'general'])
    .order('type', { ascending: false }) // Prioriza 'sale' si existe
    .limit(1)
    .single();

  if (!journal) {
    throw new Error('No existe un diario de ventas o general configurado para la empresa.');
  }

  // 3. Crear el asiento contable (Move)
  const totalRetenido = Number(withholding.valor_ret_renta) + Number(withholding.valor_ret_iva);
  if (totalRetenido <= 0) {
    throw new Error('La retención tiene un valor total de cero.');
  }

  const ref = withholding.ret_number ? `Ret. Recibida ${withholding.ret_number}` : `Ret. Recibida #${withholding.id}`;
  const narration = `Retención de ${withholding.partner.name} ${withholding.sale ? `(Factura ${withholding.sale.invoice_ref || withholding.sale.name})` : ''}`;

  const { data: move, error: moveError } = await supabase
    .from('account_move')
    .insert({
      company_id: withholding.company_id,
      journal_id: journal.id,
      move_type: 'entry', // Asiento regular
      partner_id: withholding.partner_id,
      date: withholding.date,
      ref: ref,
      narration: narration,
      state: 'draft',
      amount_untaxed: totalRetenido,
      amount_tax: 0,
      amount_total: totalRetenido,
    })
    .select()
    .single();

  if (moveError || !move) throw new Error('Error creando asiento contable: ' + moveError?.message);

  const moveLines: MoveLineInput[] = [];

  // 4. Débitos (Activo): Anticipos de Impuestos Retenidos
  if (Number(withholding.valor_ret_renta) > 0) {
    moveLines.push({
      account_id: account_withholding_rent_id,
      partner_id: withholding.partner_id,
      name: 'Anticipo Retención Renta',
      debit: Number(withholding.valor_ret_renta),
      credit: 0
    });
  }

  if (Number(withholding.valor_ret_iva) > 0) {
    moveLines.push({
      account_id: account_withholding_iva_id,
      partner_id: withholding.partner_id,
      name: 'Anticipo Retención IVA',
      debit: Number(withholding.valor_ret_iva),
      credit: 0
    });
  }

  // 5. Crédito (Activo): Cuentas por Cobrar (Reducimos lo que debe el cliente)
  moveLines.push({
    account_id: withholding.partner.property_account_receivable_id,
    partner_id: withholding.partner_id,
    name: 'Aplicación de Retención Recibida',
    debit: 0,
    credit: totalRetenido
  });

  // 6. Insertar Líneas
  const dbLines = moveLines.map(l => ({
    move_id: move.id,
    company_id: withholding.company_id,
    ...l,
    date: withholding.date
  }));

  const { error: linesError } = await supabase.from('account_move_line').insert(dbLines);
  if (linesError) {
    // Intentar rollback eliminando el move (no es atómico sin RPC, pero ayuda)
    await supabase.from('account_move').delete().eq('id', move.id);
    throw new Error('Error insertando líneas de asiento: ' + linesError.message);
  }

  // 7. Actualizar la retención con el ID del asiento
  await supabase.from('sale_received_withholding').update({ account_move_id: move.id }).eq('id', withholding.id);

  return move.id;
}
