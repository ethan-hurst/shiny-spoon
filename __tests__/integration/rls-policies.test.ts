import { createClient } from '@supabase/supabase-js'
import { createTestUser, createTestOrganization, createTestProduct } from '../utils/supabase-mocks'

// Skip these tests in CI as they require a running Supabase instance
const describeWithSupabase = process.env.CI ? describe.skip : describe

describeWithSupabase('RLS Policies', () => {
  let supabase: any
  let adminSupabase: any
  
  // Test users
  const user1 = {
    email: 'test-user-1@example.com',
    password: 'test-password-123',
    organizationId: 'org-1-id',
  }
  
  const user2 = {
    email: 'test-user-2@example.com',
    password: 'test-password-456',
    organizationId: 'org-2-id',
  }
  
  beforeAll(async () => {
    // Initialize Supabase clients
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Clean up any existing test users
    await adminSupabase.auth.admin.deleteUser(user1.email).catch(() => {})
    await adminSupabase.auth.admin.deleteUser(user2.email).catch(() => {})
    
    // Create test organizations
    await adminSupabase.from('organizations').insert([
      { id: user1.organizationId, name: 'Test Org 1', slug: 'test-org-1' },
      { id: user2.organizationId, name: 'Test Org 2', slug: 'test-org-2' },
    ])
    
    // Create test users
    const { data: { user: createdUser1 } } = await adminSupabase.auth.admin.createUser({
      email: user1.email,
      password: user1.password,
      email_confirm: true,
    })
    
    const { data: { user: createdUser2 } } = await adminSupabase.auth.admin.createUser({
      email: user2.email,
      password: user2.password,
      email_confirm: true,
    })
    
    // Create user profiles
    await adminSupabase.from('user_profiles').insert([
      { user_id: createdUser1!.id, organization_id: user1.organizationId },
      { user_id: createdUser2!.id, organization_id: user2.organizationId },
    ])
    
    // Create test data for each organization
    await adminSupabase.from('products').insert([
      { 
        id: 'product-1-id',
        organization_id: user1.organizationId, 
        sku: 'PROD-1', 
        name: 'Product 1' 
      },
      { 
        id: 'product-2-id',
        organization_id: user2.organizationId, 
        sku: 'PROD-2', 
        name: 'Product 2' 
      },
    ])
  })
  
  afterAll(async () => {
    // Clean up test data
    await adminSupabase.from('products').delete().in('id', ['product-1-id', 'product-2-id'])
    await adminSupabase.from('user_profiles').delete().in('organization_id', [user1.organizationId, user2.organizationId])
    await adminSupabase.from('organizations').delete().in('id', [user1.organizationId, user2.organizationId])
    await adminSupabase.auth.admin.deleteUser(user1.email).catch(() => {})
    await adminSupabase.auth.admin.deleteUser(user2.email).catch(() => {})
  })
  
  describe('Product RLS Policies', () => {
    it('should only allow users to see their organization products', async () => {
      // Sign in as user 1
      const { data: { session: session1 } } = await supabase.auth.signInWithPassword({
        email: user1.email,
        password: user1.password,
      })
      
      expect(session1).toBeTruthy()
      
      // User 1 should only see Product 1
      const { data: products1, error: error1 } = await supabase
        .from('products')
        .select('*')
      
      expect(error1).toBeNull()
      expect(products1).toHaveLength(1)
      expect(products1[0].sku).toBe('PROD-1')
      
      // Sign out and sign in as user 2
      await supabase.auth.signOut()
      
      const { data: { session: session2 } } = await supabase.auth.signInWithPassword({
        email: user2.email,
        password: user2.password,
      })
      
      expect(session2).toBeTruthy()
      
      // User 2 should only see Product 2
      const { data: products2, error: error2 } = await supabase
        .from('products')
        .select('*')
      
      expect(error2).toBeNull()
      expect(products2).toHaveLength(1)
      expect(products2[0].sku).toBe('PROD-2')
    })
    
    it('should prevent cross-organization data access', async () => {
      // Sign in as user 1
      await supabase.auth.signInWithPassword({
        email: user1.email,
        password: user1.password,
      })
      
      // Try to access user 2's product directly
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', 'product-2-id')
        .single()
      
      // Should not find the product
      expect(data).toBeNull()
    })
    
    it('should prevent unauthorized inserts', async () => {
      // Sign in as user 1
      await supabase.auth.signInWithPassword({
        email: user1.email,
        password: user1.password,
      })
      
      // Try to insert a product for user 2's organization
      const { error } = await supabase
        .from('products')
        .insert({
          organization_id: user2.organizationId,
          sku: 'HACK-1',
          name: 'Hacked Product',
        })
      
      // Should fail with RLS violation
      expect(error).toBeTruthy()
      expect(error.code).toBe('42501') // insufficient_privilege
    })
    
    it('should prevent unauthorized updates', async () => {
      // Sign in as user 1
      await supabase.auth.signInWithPassword({
        email: user1.email,
        password: user1.password,
      })
      
      // Try to update user 2's product
      const { error } = await supabase
        .from('products')
        .update({ name: 'Hacked Name' })
        .eq('id', 'product-2-id')
      
      // Should fail silently (no rows affected)
      expect(error).toBeNull()
      
      // Verify the product wasn't actually updated
      const { data } = await adminSupabase
        .from('products')
        .select('name')
        .eq('id', 'product-2-id')
        .single()
      
      expect(data.name).toBe('Product 2')
    })
    
    it('should prevent unauthorized deletes', async () => {
      // Sign in as user 1
      await supabase.auth.signInWithPassword({
        email: user1.email,
        password: user1.password,
      })
      
      // Try to delete user 2's product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', 'product-2-id')
      
      // Should fail silently (no rows affected)
      expect(error).toBeNull()
      
      // Verify the product still exists
      const { data } = await adminSupabase
        .from('products')
        .select('id')
        .eq('id', 'product-2-id')
        .single()
      
      expect(data).toBeTruthy()
    })
  })
  
  describe('RLS Policy Validation', () => {
    it('should have RLS enabled on all critical tables', async () => {
      const criticalTables = [
        'organizations',
        'user_profiles',
        'products',
        'warehouses',
        'inventory',
        'customers',
        'pricing_rules',
        'customer_pricing',
      ]
      
      for (const table of criticalTables) {
        const { data, error } = await adminSupabase
          .rpc('check_table_rls_enabled', { table_name: table })
        
        expect(error).toBeNull()
        expect(data).toBe(true)
      }
    })
  })
})