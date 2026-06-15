// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Funciones helper para operaciones CRUD CAPA 0

// Partners
export async function getPartners(companyId: number) {
  const { data, error } = await supabase
    .from('res_partner')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('name');
  
  if (error) throw error;
  return data;
}

export async function getPartner(id: number) {
  const { data, error } = await supabase
    .from('res_partner')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

export async function createPartner(partner: any) {
  const { data, error } = await supabase
    .from('res_partner')
    .insert([partner])
    .select();
  
  if (error) throw error;
  return data[0];
}

export async function updatePartner(id: number, updates: any) {
  const { data, error } = await supabase
    .from('res_partner')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
}

// Products
export async function getProducts(active = true) {
  const { data, error } = await supabase
    .from('product_product')
    .select(`
      *,
      template:product_template(
        *,
        category:product_category(*)
      )
    `)
    .eq('active', active)
    .order('id');
  
  if (error) throw error;
  return data;
}

export async function createProduct(product: any) {
  const { data, error } = await supabase
    .from('product_product')
    .insert([product])
    .select();
  
  if (error) throw error;
  return data[0];
}

// Companies
export async function getCompanies() {
  const { data, error } = await supabase
    .from('res_company')
    .select('*')
    .eq('active', true)
    .order('name');
  
  if (error) throw error;
  return data;
}

export async function getCompany(id: number) {
  const { data, error } = await supabase
    .from('res_company')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

// Users
export async function getUser(id: number) {
  const { data, error } = await supabase
    .from('res_users')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUsersByCompany(companyId: number) {
  const { data, error } = await supabase
    .from('res_users')
    .select('*')
    .contains('company_ids', [companyId])
    .order('name');
  
  if (error) throw error;
  return data;
}
