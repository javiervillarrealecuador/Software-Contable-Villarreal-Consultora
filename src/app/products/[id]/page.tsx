import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProductFormDesktop from '@/components/products/ProductFormDesktop';
import type { ProductFormData } from '@/types/capa0';

export const metadata = {
  title: 'Editar Producto - ERP Ecuador',
};

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const productId = parseInt(params.id);
  if (isNaN(productId)) {
    redirect('/products');
  }

  // Cargar el producto y el template usando query directa
  const { data: product, error } = await supabase
    .from('product_product')
    .select(`
      id,
      code,
      active,
      product_tmpl_id,
      template:product_template(
        name,
        category_id,
        type,
        uom_id,
        list_price,
        standard_price,
        description,
        reference,
        group1,
        group2,
        group3,
        stock_unit,
        min_stock,
        max_stock,
        cost_center,
        iva_code,
        has_ice,
        ice_percentage,
        price_1,
        price_2,
        price_3,
        price_4,
        price_5,
        price_6,
        discount_percentage,
        previous_price,
        promo_quantity,
        promo_valid_until,
        warehouse_location,
        active,
        income_account_id,
        expense_account_id
      )
    `)
    .eq('id', productId)
    .single();

  if (error || !product || !product.template) {
    console.error('Error cargando producto:', error);
    redirect('/products');
  }

  const tmpl = product.template as any;

  // Preparar los datos iniciales para el formulario
  const initialData: ProductFormData = {
    id: product.id,
    tmpl_id: product.product_tmpl_id,
    name: tmpl.name || '',
    category_id: tmpl.category_id || undefined,
    type: tmpl.type || 'product',
    uom_id: tmpl.uom_id || 1,
    list_price: tmpl.list_price || 0,
    standard_price: tmpl.standard_price || 0,
    description: tmpl.description || '',
    reference: tmpl.reference || '',
    group1: tmpl.group1 || '',
    group2: tmpl.group2 || '',
    group3: tmpl.group3 || '',
    stock_unit: tmpl.stock_unit || 'UNIDAD',
    min_stock: tmpl.min_stock || 0,
    max_stock: tmpl.max_stock || 0,
    cost_center: tmpl.cost_center || '',
    iva_code: tmpl.iva_code || '15%',
    has_ice: tmpl.has_ice || false,
    ice_percentage: tmpl.ice_percentage || 0,
    price_1: tmpl.price_1 || 0,
    price_2: tmpl.price_2 || 0,
    price_3: tmpl.price_3 || 0,
    price_4: tmpl.price_4 || 0,
    price_5: tmpl.price_5 || 0,
    price_6: tmpl.price_6 || 0,
    discount_percentage: tmpl.discount_percentage || 0,
    previous_price: tmpl.previous_price || 0,
    promo_quantity: tmpl.promo_quantity || 0,
    promo_valid_until: tmpl.promo_valid_until || '',
    warehouse_location: tmpl.warehouse_location || '',
    active: product.active,
    income_account_id: tmpl.income_account_id || undefined,
    expense_account_id: tmpl.expense_account_id || undefined,
    presentations: [] // Asumimos que no cargamos las presentaciones en este query simple por ahora
  };

  // Se podría cargar las presentaciones también
  const { data: presentations } = await supabase
    .from('product_presentation')
    .select('*')
    .eq('product_tmpl_id', product.product_tmpl_id);
    
  if (presentations) {
    initialData.presentations = presentations;
  }

  // Pasamos el ID del template para que el componente (o el endpoint PUT) sepa qué actualizar
  // Necesitamos añadir id a ProductFormData o usar otra forma. El formulario asume que si hay initialData
  // se trata de una edición. Pero la api POST `/api/products` crea uno nuevo. 
  // Ojo: si hay que hacer update, hay que agregar esa logica en ProductFormDesktop.

  return <ProductFormDesktop initialData={initialData} />;
}
