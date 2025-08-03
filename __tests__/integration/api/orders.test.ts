import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServerClient } from '@/lib/supabase/server'

// Test database setup
const testSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const testSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key'

describe('Orders API Integration Tests', () => {
  let supabase: any
  let testUser: any
  let testOrganization: any
  let testCustomer: any
  let testProducts: any[]

  beforeAll(async () => {
    // Initialize test database client
    supabase = createClient(testSupabaseUrl, testSupabaseKey)

    // Create test data
    await setupTestData()
  })

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData()
  })

  beforeEach(async () => {
    // Reset test state between tests
    await resetTestState()
  })

  async function setupTestData() {
    // Create test organization
    const { data: org } = await supabase
      .from('organizations')
      .insert({
        name: 'Test Organization',
        slug: 'test-org',
        plan: 'pro',
      })
      .select()
      .single()

    testOrganization = org

    // Create test user
    const { data: user } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'testpassword123',
    })

    testUser = user.user

    // Create user profile
    await supabase.from('user_profiles').insert({
      user_id: testUser.id,
      organization_id: testOrganization.id,
      role: 'admin',
      full_name: 'Test User',
    })

    // Create test customer
    const { data: customer } = await supabase
      .from('customers')
      .insert({
        organization_id: testOrganization.id,
        name: 'Test Customer',
        email: 'customer@example.com',
        status: 'active',
      })
      .select()
      .single()

    testCustomer = customer

    // Create test products
    const { data: products } = await supabase
      .from('products')
      .insert([
        {
          organization_id: testOrganization.id,
          sku: 'TEST-001',
          name: 'Test Product 1',
          description: 'Test product description',
          base_price: 10.0,
          category: 'test',
        },
        {
          organization_id: testOrganization.id,
          sku: 'TEST-002',
          name: 'Test Product 2',
          description: 'Test product description 2',
          base_price: 20.0,
          category: 'test',
        },
      ])
      .select()

    testProducts = products || []
  }

  async function cleanupTestData() {
    // Clean up in reverse order of creation
    if (testProducts.length > 0) {
      await supabase
        .from('products')
        .delete()
        .in(
          'id',
          testProducts.map((p) => p.id)
        )
    }

    if (testCustomer) {
      await supabase.from('customers').delete().eq('id', testCustomer.id)
    }

    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id)
    }

    if (testOrganization) {
      await supabase
        .from('organizations')
        .delete()
        .eq('id', testOrganization.id)
    }
  }

  async function resetTestState() {
    // Clear orders and related data
    await supabase
      .from('order_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    await supabase
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
  }

  describe('POST /api/orders', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        customer_id: testCustomer.id,
        items: [
          {
            product_id: testProducts[0].id,
            quantity: 2,
            unit_price: 10.0,
          },
          {
            product_id: testProducts[1].id,
            quantity: 1,
            unit_price: 20.0,
          },
        ],
        billing_address: {
          line1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postal_code: '12345',
          country: 'US',
        },
        notes: 'Test order',
      }

      // Mock the server action
      const { createOrder } = await import('@/app/actions/orders')

      // Sign in as test user
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      })

      const result = await createOrder(orderData)

      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        customer_id: testCustomer.id,
        status: 'pending',
        subtotal: 40.0, // 2 * 10 + 1 * 20
        tax: 4.0, // 10% of subtotal
        total: 44.0,
      })

      // Verify order items were created
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', result.data.id)

      expect(orderItems).toHaveLength(2)
      expect(orderItems[0]).toMatchObject({
        product_id: testProducts[0].id,
        quantity: 2,
        unit_price: 10.0,
        total_price: 20.0,
      })
    })

    it('should return error for invalid product', async () => {
      const orderData = {
        customer_id: testCustomer.id,
        items: [
          {
            product_id: 'invalid-product-id',
            quantity: 1,
            unit_price: 10.0,
          },
        ],
      }

      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      })

      const { createOrder } = await import('@/app/actions/orders')
      const result = await createOrder(orderData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Product invalid-product-id not found')
    })

    it('should return error when not authenticated', async () => {
      const orderData = {
        customer_id: testCustomer.id,
        items: [
          {
            product_id: testProducts[0].id,
            quantity: 1,
            unit_price: 10.0,
          },
        ],
      }

      // Don't sign in
      const { createOrder } = await import('@/app/actions/orders')
      const result = await createOrder(orderData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unauthorized')
    })
  })

  describe('PUT /api/orders/[id]', () => {
    let testOrder: any

    beforeEach(async () => {
      // Create a test order
      const { data: order } = await supabase
        .from('orders')
        .insert({
          organization_id: testOrganization.id,
          order_number: 'TEST-001',
          customer_id: testCustomer.id,
          status: 'pending',
          subtotal: 30.0,
          tax: 3.0,
          total: 33.0,
          created_by: testUser.id,
        })
        .select()
        .single()

      testOrder = order
    })

    it('should update an order successfully', async () => {
      const updateData = {
        status: 'confirmed',
        notes: 'Order confirmed',
      }

      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      })

      const { updateOrder } = await import('@/app/actions/orders')
      const result = await updateOrder(testOrder.id, updateData)

      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        id: testOrder.id,
        status: 'confirmed',
        notes: 'Order confirmed',
      })
    })

    it('should return error when order not found', async () => {
      const updateData = {
        status: 'confirmed',
      }

      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      })

      const { updateOrder } = await import('@/app/actions/orders')
      const result = await updateOrder('non-existent-id', updateData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Order not found')
    })
  })

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      // Create test orders
      await supabase.from('orders').insert([
        {
          organization_id: testOrganization.id,
          order_number: 'TEST-001',
          customer_id: testCustomer.id,
          status: 'pending',
          subtotal: 30.0,
          tax: 3.0,
          total: 33.0,
          created_by: testUser.id,
        },
        {
          organization_id: testOrganization.id,
          order_number: 'TEST-002',
          customer_id: testCustomer.id,
          status: 'confirmed',
          subtotal: 50.0,
          tax: 5.0,
          total: 55.0,
          created_by: testUser.id,
        },
      ])
    })

    it('should list orders successfully', async () => {
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      })

      const { listOrders } = await import('@/app/actions/orders')
      const result = await listOrders()

      expect(result.success).toBe(true)
      expect(result.data.orders).toHaveLength(2)
      expect(result.data.total).toBe(2)
    })

    it('should filter orders by status', async () => {
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      })

      const { listOrders } = await import('@/app/actions/orders')
      const result = await listOrders({ status: 'pending' })

      expect(result.success).toBe(true)
      expect(result.data.orders).toHaveLength(1)
      expect(result.data.orders[0].status).toBe('pending')
    })
  })
})
