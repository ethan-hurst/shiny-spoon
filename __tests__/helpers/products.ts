import { createAdminClient } from '@/lib/supabase/admin'

export async function createTestProduct(organizationId: string) {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('products')
    .insert({
      organization_id: organizationId,
      sku: `TEST-${Date.now()}`,
      name: 'Test Product',
      base_price: 99.99,
      cost: 50,
      active: true,
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

export async function deleteTestProduct(productId: string) {
  const supabase = createAdminClient()
  
  await supabase
    .from('products')
    .delete()
    .eq('id', productId)
}