import { createAdminClient } from '@/lib/supabase/admin'

export async function createTestCustomer(organizationId: string) {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('customers')
    .insert({
      organization_id: organizationId,
      name: 'Test Customer',
      email: `test-customer-${Date.now()}@example.com`,
      phone: '555-0123',
      tier: 'bronze',
      active: true,
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

export async function deleteTestCustomer(customerId: string) {
  const supabase = createAdminClient()
  
  await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
}