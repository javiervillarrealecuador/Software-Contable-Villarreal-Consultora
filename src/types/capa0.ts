// src/types/capa0.ts

/**
 * CAPA 0 - Foundation
 * Tipos para maestros: Empresas, Partners, Usuarios, Productos, UOM
 */

// Empresa (Multiempresa)
export interface Company {
  id: number;
  name: string;
  street?: string;
  street2?: string;
  city?: string;
  state_id?: number;
  zip?: string;
  country_id?: number;
  phone?: string;
  email?: string;
  website?: string;
  vat?: string; // RUC Ecuador
  partner_id?: number;
  currency_id: number;
  logo?: string; // base64
  active: boolean;
  created_at: string;
  updated_at: string;

  // Integración Contable
  account_sale_tax_id?: number;
  account_purchase_tax_id?: number;
  account_withholding_rent_id?: number;
  account_withholding_iva_id?: number;
}

// Partner (Cliente, Proveedor, Contacto)
export interface Partner {
  id: number;
  company_id: number;
  parent_id?: number;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  street?: string;
  street2?: string;
  city?: string;
  state_id?: number;
  zip?: string;
  country_id?: number;
  vat?: string; // RUC/Cédula
  is_company: boolean;
  company_name?: string;
  company_type: 'person' | 'company';
  is_customer?: boolean;
  is_supplier?: boolean;
  active: boolean;
  type: 'contact' | 'invoice' | 'delivery' | 'other';
  lang?: string;
  tz?: string;

  // Campos Avanzados (SRI / Detalles)
  identification_type?: string;
  title?: string;
  trade_name?: string;
  alias?: string;
  street_number?: string;
  cross_street?: string;
  fax?: string;
  contact_preference?: string;
  job_title?: string;
  legal_representative?: string;

  is_collector?: boolean;
  is_salesperson?: boolean;
  is_employee?: boolean;
  is_agent?: boolean;
  is_insurance_company?: boolean;
  is_partner_shareholder?: boolean;
  is_student?: boolean;
  is_exporter?: boolean;
  is_importer?: boolean;
  is_carrier?: boolean;

  comment?: string;
  is_large_taxpayer?: boolean;
  is_special_taxpayer?: boolean;
  is_withholding_agent?: boolean;
  rimpe_type?: string;

  credit_days?: number;
  zone?: string;
  product_line?: string;

  bank_name?: string;
  bank_account_type?: string;
  bank_account_number?: string;
  bank_account_id_number?: string;

  // Accounting integration
  property_account_receivable_id?: number;
  property_account_payable_id?: number;

  created_at: string;
  updated_at: string;
  created_uid?: number;
  write_uid?: number;
  write_date?: string;
}

// Usuario
export interface User {
  id: number;
  name: string;
  email: string;
  login: string;
  password_hash?: string;
  partner_id: number;
  company_id: number;
  company_ids: number[]; // Multiempresa
  active: boolean;
  share: boolean; // true = portal user, false = internal user
  lang: string;
  tz?: string;
  signature?: string;
  is_superadmin?: boolean;
  role?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// Producto
export interface Product {
  id: number;
  product_tmpl_id: number;
  code?: string;
  barcode?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  template?: ProductTemplate;
}

// Template de Producto
export interface ProductTemplate {
  id: number;
  name: string;
  category_id?: number;
  type: 'product' | 'service' | 'consu';
  uom_id: number;
  uom_po_id?: number;
  description?: string;
  list_price: number;
  standard_price: number;
  
  // Accounting integration
  income_account_id?: number;
  expense_account_id?: number;

  active: boolean;
  created_at: string;
  updated_at: string;
  category?: ProductCategory;
}

// Categoría de Producto
export interface ProductCategory {
  id: number;
  name: string;
  parent_id?: number;
  active: boolean;
  created_at: string;
}

// Unidad de Medida
export interface UOM {
  id: number;
  name: string;
  category_id: number;
  factor: number;
  rounding: number;
  active: boolean;
  created_at: string;
  category?: UOMCategory;
}

// Categoría UOM
export interface UOMCategory {
  id: number;
  name: string;
  created_at: string;
}

// País
export interface Country {
  id: number;
  name: string;
  code: string;
  phone_code?: string;
  created_at: string;
}

// Provincia/Estado
export interface State {
  id: number;
  country_id: number;
  name: string;
  code?: string;
  created_at: string;
}

// Moneda
export interface Currency {
  id: number;
  name: string;
  symbol: string;
  rate: number;
  active: boolean;
  created_at: string;
}

// Tipos para formularios (Form Data)
export interface PartnerFormData {
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  vat?: string;
  is_company: boolean;
  company_name?: string;
  country_id?: number;
  state_id?: number;
  city?: string;
  zip?: string;
  street?: string;
  is_customer: boolean;
  is_supplier: boolean;

  // Campos Avanzados
  identification_type?: string;
  title?: string;
  trade_name?: string;
  alias?: string;
  street_number?: string;
  cross_street?: string;
  fax?: string;
  contact_preference?: string;
  job_title?: string;
  legal_representative?: string;

  is_collector: boolean;
  is_salesperson: boolean;
  is_employee: boolean;
  is_agent: boolean;
  is_insurance_company: boolean;
  is_partner_shareholder: boolean;
  is_student: boolean;
  is_exporter: boolean;
  is_importer: boolean;
  is_carrier: boolean;

  comment?: string;
  is_large_taxpayer: boolean;
  is_special_taxpayer: boolean;
  is_withholding_agent: boolean;
  rimpe_type?: string;

  credit_days: number;
  zone?: string;
  product_line?: string;

  bank_name?: string;
  bank_account_type?: string;
  bank_account_number?: string;
  bank_account_id_number?: string;

  // Accounting integration
  property_account_receivable_id?: number;
  property_account_payable_id?: number;
}

export interface ProductPresentation {
  id?: number;
  product_tmpl_id?: number;
  name: string;
  barcode?: string;
  gross_weight: number;
  weight_unit?: string;
  price_1: number;
  price_2: number;
  price_3: number;
  price_4: number;
  price_5: number;
  price_6: number;
}

export interface ProductFormData {
  id?: number;
  tmpl_id?: number;
  name: string;
  category_id?: number;
  type: 'product' | 'service' | 'consu';
  uom_id: number;
  list_price: number;
  standard_price: number;
  description?: string;
  
  // Advanced Fields
  reference?: string;
  group1?: string;
  group2?: string;
  group3?: string;
  stock_unit?: string;
  min_stock?: number;
  max_stock?: number;
  cost_center?: string;
  iva_code?: string;
  has_ice?: boolean;
  ice_percentage?: number;
  price_1?: number;
  price_2?: number;
  price_3?: number;
  price_4?: number;
  price_5?: number;
  price_6?: number;
  discount_percentage?: number;
  previous_price?: number;
  promo_quantity?: number;
  promo_valid_until?: string;
  warehouse_location?: string;
  
  // Accounting integration
  income_account_id?: number;
  expense_account_id?: number;

  active?: boolean;
  
  presentations?: ProductPresentation[];
}

export interface CompanyFormData {
  name: string;
  vat: string;
  currency_id: number;
  email?: string;
  phone?: string;
  country_id?: number;
  state_id?: number;
  city?: string;
}
