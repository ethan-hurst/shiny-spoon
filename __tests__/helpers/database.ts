import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

interface TestData {
  organizationId: string
  userId: string
  integrationId: string
}

export async function setupTestDatabase(): Promise<TestData> {
  const supabase = await createClient()
  
  // Create test organization
  const orgId = uuidv4()
  const { error: orgError } = await supabase
    .from('organizations')
    .insert({
      id: orgId,
      name: 'Test Organization',
      plan: 'test',
    })
  
  if (orgError) throw orgError
  
  // Create test user
  const userId = uuidv4()
  const { error: userError } = await supabase
    .from('user_profiles')
    .insert({
      user_id: userId,
      organization_id: orgId,
      role: 'admin',
      email: 'test@example.com',
    })
  
  if (userError) throw userError
  
  // Create test integration
  const integrationId = uuidv4()
  const { error: intError } = await supabase
    .from('integrations')
    .insert({
      id: integrationId,
      organization_id: orgId,
      platform: 'shopify',
      name: 'Test Shopify Store',
      config: {
        store_url: 'test.myshopify.com',
        api_key: 'test-key',
        api_secret: 'test-secret',
      },
      active: true,
    })
  
  if (intError) throw intError
  
  return {
    organizationId: orgId,
    userId,
    integrationId,
  }
}

export async function cleanupTestDatabase(): Promise<void> {
  const supabase = await createClient()
  
  // Clean up in reverse order of creation to avoid foreign key constraints
  await supabase.from('sync_logs').delete().neq('id', '')
  await supabase.from('sync_configs').delete().neq('id', '')
  await supabase.from('integrations').delete().neq('id', '')
  await supabase.from('user_profiles').delete().neq('user_id', '')
  await supabase.from('organizations').delete().neq('id', '')
}