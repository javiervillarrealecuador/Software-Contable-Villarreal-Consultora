// src/types/capa2.ts
// CAPA 2 - Tributacion Ecuador: retenciones, comprobantes, ATS

export type TaxpayerType =
  | 'regimen_general'
  | 'contribuyente_especial'
  | 'gran_contribuyente'
  | 'rimpe_emprendedor'
  | 'rimpe_negocio_popular'
  | 'persona_natural_no_obligada'
  | 'sector_publico'
  | 'exportador_habitual';

export const TAXPAYER_LABELS: Record<TaxpayerType, string> = {
  regimen_general: 'Régimen General',
  contribuyente_especial: 'Contribuyente Especial',
  gran_contribuyente: 'Gran Contribuyente',
  rimpe_emprendedor: 'RIMPE Emprendedor',
  rimpe_negocio_popular: 'RIMPE Negocio Popular',
  persona_natural_no_obligada: 'Persona Natural no obligada',
  sector_publico: 'Sector Público / Universidades',
  exportador_habitual: 'Exportador Habitual',
};

export type IvaTarget =
  | 'goods'
  | 'services'
  | 'prof_fees'
  | 'rent_property'
  | 'purchase_settlement'
  | 'construction';

export const IVA_TARGET_LABELS: Record<IvaTarget, string> = {
  goods: 'Bienes',
  services: 'Servicios',
  prof_fees: 'Honorarios profesionales (PN)',
  rent_property: 'Arriendo inmueble (PN sin contabilidad)',
  purchase_settlement: 'Liquidación de compra',
  construction: 'Contrato de construcción',
};

// Regla de retencion renta
export interface RentRule {
  id: number;
  air_code?: string;
  name: string;
  percent: number;
  applies_to: 'goods' | 'services' | 'both';
  legal_ref?: string;
  active: boolean;
  account_id?: number; // Added from company_rent_rule_account
}

// Regla de retencion IVA
export interface IvaRule {
  id: number;
  buyer_type: TaxpayerType;
  seller_type: TaxpayerType;
  target: IvaTarget;
  percent: number;
  note?: string;
  active: boolean;
  account_id?: number; // Added from company_iva_rule_account
}

// Comprobante de retencion
export interface Withhold {
  id: number;
  company_id: number;
  partner_id: number;
  move_id?: number;
  number?: string;
  date: string;
  invoice_ref?: string;
  invoice_auth?: string;
  invoice_date?: string;
  base_iva: number;
  base_renta: number;
  total_iva_withheld: number;
  total_rent_withheld: number;
  state: 'draft' | 'posted' | 'cancel';
  created_at: string;
  partner?: any;
  lines?: WithholdLine[];
}

export interface WithholdLine {
  id: number;
  withhold_id: number;
  tax_type: 'rent' | 'iva';
  rule_code?: string;
  description?: string;
  base: number;
  percent: number;
  amount: number;
}

// Input para calcular una retencion
export interface WithholdCalcInput {
  buyer_type: TaxpayerType;       // tipo de la empresa que retiene
  seller_type: TaxpayerType;      // tipo del proveedor
  target: IvaTarget;              // bienes/servicios/casos especiales
  base_imponible: number;         // base gravada (sin IVA)
  iva_rate: number;               // 15, 5, 0
  rent_rule_id: number;           // regla renta elegida
}

// Resultado del calculo
export interface WithholdCalcResult {
  iva_amount: number;             // IVA de la factura
  iva_withhold_percent: number;   // % retencion IVA aplicado
  iva_withhold_amount: number;    // valor retenido de IVA
  rent_withhold_percent: number;  // % retencion renta
  rent_withhold_amount: number;   // valor retenido de renta
  total_withheld: number;
  net_payable: number;            // lo que efectivamente se paga al proveedor
}
