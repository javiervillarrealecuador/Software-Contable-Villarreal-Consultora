// src/lib/accounting.ts

/**
 * CAPA 1 - Funciones de acceso a datos contables
 * Plan de cuentas, diarios, impuestos, asientos
 */

import { supabase } from './supabase';
import type { MoveFormData } from '@/types/capa1';
import { isMoveBalanced } from '@/types/capa1';

// ============ PLAN DE CUENTAS ============

export async function getAccounts(companyId: number) {
  const { data, error } = await supabase
    .from('account_account')
    .select(`
      *,
      account_type:account_account_type(*)
    `)
    .eq('company_id', companyId)
    .eq('active', true)
    .order('code');

  if (error) throw error;
  return data;
}

export async function getAccountTypes() {
  const { data, error } = await supabase
    .from('account_account_type')
    .select('*')
    .order('code');

  if (error) throw error;
  return data;
}

export async function createAccount(account: any) {
  const { data, error } = await supabase
    .from('account_account')
    .insert([account])
    .select();

  if (error) throw error;
  return data[0];
}

export async function updateAccount(id: number, updates: any) {
  const { data, error } = await supabase
    .from('account_account')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
}

export async function deleteAccount(id: number) {
  const { error } = await supabase
    .from('account_account')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// ============ DIARIOS ============

export async function getJournals(companyId: number) {
  const { data, error } = await supabase
    .from('account_journal')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('code');

  if (error) throw error;
  return data;
}

export async function createJournal(journal: any) {
  const { data, error } = await supabase
    .from('account_journal')
    .insert([journal])
    .select();

  if (error) throw error;
  return data[0];
}

// ============ IMPUESTOS ============

export async function getTaxes(companyId: number) {
  const { data, error } = await supabase
    .from('account_tax')
    .select(`
      *,
      tax_group:account_tax_group(*),
      account:account_account(id, code, name)
    `)
    .eq('company_id', companyId)
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data;
}

export async function createTax(tax: any) {
  const { data, error } = await supabase
    .from('account_tax')
    .insert([tax])
    .select();

  if (error) throw error;
  return data[0];
}

// ============ ASIENTOS CONTABLES ============

export async function getMoves(companyId: number, limit = 50) {
  const { data, error } = await supabase
    .from('account_move')
    .select(`
      *,
      journal:account_journal(id, name, code, type),
      lines:account_move_line(
        *,
        account:account_account(id, code, name)
      )
    `)
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getMove(id: number) {
  const { data, error } = await supabase
    .from('account_move')
    .select(`
      *,
      journal:account_journal(id, name, code, type),
      lines:account_move_line(
        *,
        account:account_account(id, code, name)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Crea un asiento contable completo (cabecera + líneas).
 * Valida partida doble ANTES de guardar.
 */
export async function createMove(companyId: number, moveData: MoveFormData) {
  // 1. Validar partida doble
  if (!isMoveBalanced(moveData.lines)) {
    throw new Error('El asiento no está balanceado: la suma de débitos debe ser igual a la suma de créditos.');
  }

  if (moveData.lines.length < 2) {
    throw new Error('Un asiento debe tener al menos 2 líneas (partida doble).');
  }

  // 2. Obtener el diario para generar el número de asiento
  const { data: journal, error: journalError } = await supabase
    .from('account_journal')
    .select('*')
    .eq('id', moveData.journal_id)
    .single();

  if (journalError) throw journalError;

  const moveName = `${journal.sequence_prefix || journal.code + '/'}${String(journal.sequence_number).padStart(4, '0')}`;

  // 3. Crear la cabecera del asiento
  const totalDebit = moveData.lines.reduce((s, l) => s + (l.debit || 0), 0);

  const { data: move, error: moveError } = await supabase
    .from('account_move')
    .insert([{
      company_id: companyId,
      journal_id: moveData.journal_id,
      name: moveName,
      move_type: 'entry',
      partner_id: moveData.partner_id || null,
      date: moveData.date,
      ref: moveData.ref || null,
      narration: moveData.narration || null,
      state: 'draft',
      amount_total: Math.round(totalDebit * 100) / 100,
    }])
    .select()
    .single();

  if (moveError) throw moveError;

  // 4. Crear las líneas
  const lines = moveData.lines.map(line => ({
    move_id: move.id,
    company_id: companyId,
    account_id: line.account_id,
    partner_id: line.partner_id || null,
    name: line.name || null,
    debit: line.debit || 0,
    credit: line.credit || 0,
    date: moveData.date,
  }));

  const { error: linesError } = await supabase
    .from('account_move_line')
    .insert(lines);

  if (linesError) {
    // Rollback manual: eliminar la cabecera si fallan las líneas
    await supabase.from('account_move').delete().eq('id', move.id);
    throw linesError;
  }

  // 5. Incrementar la secuencia del diario
  await supabase
    .from('account_journal')
    .update({ sequence_number: journal.sequence_number + 1 })
    .eq('id', journal.id);

  return move;
}

/**
 * Publica un asiento (draft → posted).
 * El trigger en la BD valida nuevamente la partida doble.
 */
export async function postMove(moveId: number) {
  const { data, error } = await supabase
    .from('account_move')
    .update({ state: 'posted', updated_at: new Date().toISOString() })
    .eq('id', moveId)
    .eq('state', 'draft')
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Cancela un asiento
 */
export async function cancelMove(moveId: number) {
  const { data, error } = await supabase
    .from('account_move')
    .update({ state: 'cancel', updated_at: new Date().toISOString() })
    .eq('id', moveId)
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Pasa un asiento a estado borrador
 */
export async function draftMove(moveId: number) {
  const { data, error } = await supabase
    .from('account_move')
    .update({ state: 'draft', updated_at: new Date().toISOString() })
    .eq('id', moveId)
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Elimina un asiento contable
 */
export async function deleteMove(moveId: number) {
  const { error } = await supabase
    .from('account_move')
    .delete()
    .eq('id', moveId);

  if (error) throw error;
  return true;
}

// ============ REPORTES BÁSICOS ============

/**
 * Balance de comprobación: saldos por cuenta (solo asientos posted)
 */
export async function getTrialBalance(companyId: number, dateFrom?: string, dateTo?: string) {
  let query = supabase
    .from('account_move_line')
    .select(`
      account_id,
      debit,
      credit,
      account:account_account(id, code, name),
      move:account_move!inner(state)
    `)
    .eq('company_id', companyId)
    .eq('move.state', 'posted');

  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  const { data, error } = await query;
  if (error) throw error;

  // Agrupar por cuenta
  const balances: Record<number, { account: any; debit: number; credit: number; balance: number }> = {};
  
  for (const line of data || []) {
    if (!balances[line.account_id]) {
      balances[line.account_id] = {
        account: line.account,
        debit: 0,
        credit: 0,
        balance: 0,
      };
    }
    balances[line.account_id].debit += line.debit;
    balances[line.account_id].credit += line.credit;
    balances[line.account_id].balance = balances[line.account_id].debit - balances[line.account_id].credit;
  }

  return Object.values(balances).sort((a, b) => 
    (a.account?.code || '').localeCompare(b.account?.code || '')
  );
}
