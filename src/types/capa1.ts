// src/types/capa1.ts

/**
 * CAPA 1 - Contabilidad Core
 * Tipos para: plan de cuentas, diarios, impuestos, asientos contables
 */

// Tipo de cuenta (define comportamiento contable)
export interface AccountType {
  id: number;
  name: string;
  code: string;
  internal_group: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'off_balance';
  created_at: string;
}

// Cuenta contable (plan de cuentas)
export interface Account {
  id: number;
  company_id: number;
  code: string;
  name: string;
  account_type_id: number;
  parent_id?: number;
  reconcile: boolean;       // true = permite conciliación (CxC, CxP)
  is_group: boolean;        // true = cuenta de agrupación, no acepta movimientos
  currency_id?: number;
  note?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Relaciones expandidas
  account_type?: AccountType;
  parent?: Account;
  children?: Account[];
}

// Diario contable
export interface Journal {
  id: number;
  company_id: number;
  name: string;
  code: string;
  type: 'sale' | 'purchase' | 'cash' | 'bank' | 'general';
  default_account_id?: number;
  sequence_number: number;
  sequence_prefix?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Grupo de impuestos
export interface TaxGroup {
  id: number;
  name: string;
  created_at: string;
}

// Impuesto
export interface Tax {
  id: number;
  company_id: number;
  name: string;
  type_tax_use: 'sale' | 'purchase' | 'none';
  amount_type: 'percent' | 'fixed';
  amount: number;           // 15.00 = 15%
  tax_group_id?: number;
  account_id?: number;      // cuenta donde se registra el impuesto
  sri_code?: string;        // código SRI para reportes
  price_include: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  tax_group?: TaxGroup;
  account?: Account;
}

// Asiento contable (documento)
export interface Move {
  id: number;
  company_id: number;
  journal_id: number;
  name?: string;            // número del asiento (VEN/2026/0001)
  move_type: 'entry' | 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund';
  partner_id?: number;
  date: string;
  ref?: string;
  narration?: string;
  state: 'draft' | 'posted' | 'cancel';
  currency_id?: number;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  created_at: string;
  updated_at: string;
  // Relaciones expandidas
  journal?: Journal;
  lines?: MoveLine[];
}

// Línea de asiento (partida doble)
export interface MoveLine {
  id: number;
  move_id: number;
  company_id: number;
  account_id: number;
  partner_id?: number;
  name?: string;
  debit: number;
  credit: number;
  balance: number;          // debit - credit (calculado en BD)
  tax_id?: number;
  date: string;
  reconciled: boolean;
  created_at: string;
  account?: Account;
}

// ============ Tipos para formularios ============

export interface AccountFormData {
  code: string;
  name: string;
  account_type_id: number;
  parent_id?: number;
  reconcile: boolean;
  is_group: boolean;
  note?: string;
}

export interface JournalFormData {
  name: string;
  code: string;
  type: 'sale' | 'purchase' | 'cash' | 'bank' | 'general';
  sequence_prefix?: string;
}

export interface TaxFormData {
  name: string;
  type_tax_use: 'sale' | 'purchase' | 'none';
  amount: number;
  tax_group_id?: number;
  account_id?: number;
  sri_code?: string;
}

// Línea de asiento para formulario (antes de guardar)
export interface MoveLineInput {
  account_id: number;
  partner_id?: number;
  name?: string;
  debit: number;
  credit: number;
}

export interface MoveFormData {
  journal_id: number;
  date: string;
  ref?: string;
  narration?: string;
  partner_id?: number;
  lines: MoveLineInput[];
}

// ============ Helpers de validación ============

/**
 * Valida que un asiento esté balanceado (suma débitos = suma créditos).
 * Principio de partida doble: todo asiento debe estar en equilibrio.
 */
export function isMoveBalanced(lines: MoveLineInput[]): boolean {
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  // Comparación con tolerancia de centavos por redondeo
  return Math.abs(totalDebit - totalCredit) < 0.005;
}

/**
 * Calcula totales de un conjunto de líneas
 */
export function getMoveTotals(lines: MoveLineInput[]) {
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  return {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    difference: Math.round((totalDebit - totalCredit) * 100) / 100,
  };
}
