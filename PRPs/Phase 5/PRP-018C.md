# PRP-018C: Implement Concrete Services and Repositories Using Base Classes

## 🚀 Quick Start

```bash
# This PRP implements concrete services and repositories extending our base classes
# Each implementation automatically gets:
✅ Retry logic with exponential backoff (BaseService)
✅ Circuit breaker pattern for resilience
✅ Organization isolation on all queries (BaseRepository)
✅ Soft deletes with audit trails
✅ Monitoring and metrics
✅ Consistent error handling
```

## Goal

Create concrete implementations of services and repositories that extend the BaseService and BaseRepository classes, retrofitting existing database operations throughout the codebase to use these standardized, secure patterns.

## Why This Matters

- **Security Gap**: Currently, no code uses BaseRepository, meaning organization isolation is inconsistently applied
- **Reliability Issues**: No services use BaseService, missing retry logic and circuit breakers
- **Monitoring Blind Spots**: No centralized metrics or error tracking
- **Code Duplication**: Each feature reimplements common patterns
- **Maintenance Burden**: Updates require changing multiple locations

Our audit found 0 services extending BaseService and 0 repositories extending BaseRepository, despite having the infrastructure ready.

## What We're Building

### Core Domain Services & Repositories

#### 1. Product Management
- `ProductService extends BaseService`
- `ProductRepository extends BaseRepository`

#### 2. Inventory Management
- `InventoryService extends BaseService`
- `InventoryRepository extends BaseRepository`

#### 3. Pricing Engine
- `PricingService extends BaseService`
- `PricingRepository extends BaseRepository`
- `PricingRuleRepository extends BaseRepository`

#### 4. Customer Management
- `CustomerService extends BaseService`
- `CustomerRepository extends BaseRepository`

#### 5. Integration Management
- `IntegrationService extends BaseService`
- `IntegrationRepository extends BaseRepository`
- `SyncJobRepository extends BaseRepository`

#### 6. Bulk Operations
- `BulkOperationService extends BaseService`
- `BulkOperationRepository extends BaseRepository`

#### 7. Monitoring & Alerts
- `AlertService extends BaseService`
- `AlertRepository extends BaseRepository`
- `AccuracyCheckRepository extends BaseRepository`

## Context & References

### Base Classes
- **BaseService**: `/lib/base/base-service.ts` - Provides retry, circuit breaker, monitoring
- **BaseRepository**: `/lib/base/base-repository.ts` - Provides org isolation, soft deletes
- **Circuit Breaker**: `/lib/resilience/circuit-breaker.ts` - Resilience pattern

### Existing Patterns to Replace
- **Direct Supabase calls**: Throughout actions and API routes
- **Manual retry logic**: `/lib/integrations/shopify/api-client.ts`
- **Inconsistent error handling**: Various locations

### Documentation
- Circuit Breaker Pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- Repository Pattern: https://martinfowler.com/eaaCatalog/repository.html
- Retry Best Practices: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/

## Implementation Blueprint

### Phase 1: Core Product Domain

#### 1.1 Product Repository
```typescript
// lib/repositories/product.repository.ts
import { BaseRepository } from '@/lib/base/base-repository'
import { createServerClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export type Product = Database['public']['Tables']['products']['Row']
export type CreateProductInput = Omit<
  Database['public']['Tables']['products']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'organization_id'
>
export type UpdateProductInput = Partial<CreateProductInput>

export class ProductRepository extends BaseRepository<Product> {
  private userId: string | null = null
  private organizationId: string | null = null

  constructor(supabase: SupabaseClient<Database>, context?: { userId?: string; organizationId?: string }) {
    super(supabase, { tableName: 'products' })
    this.userId = context?.userId || null
    this.organizationId = context?.organizationId || null
  }

  /**
   * Set context for the repository
   */
  setContext(userId: string, organizationId: string) {
    this.userId = userId
    this.organizationId = organizationId
  }

  protected getOrganizationId(): string | null {
    return this.organizationId
  }

  protected getCurrentUserId(): string | null {
    return this.userId
  }

  /**
   * Find products by SKU (exact match)
   */
  async findBySku(sku: string): Promise<Product | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('sku', sku)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw this.handleError(error)
    }

    return data as Product
  }

  /**
   * Search products by name or SKU
   */
  async search(searchTerm: string, limit = 10): Promise<Product[]> {
    const { data, error } = await this.query()
      .select('*')
      .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
      .limit(limit)
      .order('name')

    if (error) throw this.handleError(error)
    return (data || []) as Product[]
  }

  /**
   * Find products with low inventory
   */
  async findLowStock(threshold = 10): Promise<Array<Product & { current_inventory: number }>> {
    const { data, error } = await this.query()
      .select(`
        *,
        inventory!inner (
          quantity
        )
      `)
      .lt('inventory.quantity', threshold)
      .order('inventory.quantity')

    if (error) throw this.handleError(error)
    
    return (data || []).map(item => ({
      ...item,
      current_inventory: item.inventory?.[0]?.quantity || 0
    })) as Array<Product & { current_inventory: number }>
  }

  /**
   * Bulk update products
   */
  async bulkUpdate(updates: Array<{ id: string } & UpdateProductInput>): Promise<Product[]> {
    const results: Product[] = []
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 100
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      
      // Use Promise.all for parallel updates within batch
      const batchResults = await Promise.all(
        batch.map(({ id, ...data }) => this.update(id, data))
      )
      
      results.push(...batchResults)
    }
    
    return results
  }

  /**
   * Get products with pricing information
   */
  async getWithPricing(productIds?: string[]): Promise<Array<Product & { base_price?: number }>> {
    let query = this.query().select(`
      *,
      product_pricing (
        price,
        currency,
        effective_date
      )
    `)

    if (productIds && productIds.length > 0) {
      query = query.in('id', productIds)
    }

    const { data, error } = await query.order('name')

    if (error) throw this.handleError(error)

    return (data || []).map(product => ({
      ...product,
      base_price: product.product_pricing?.[0]?.price
    })) as Array<Product & { base_price?: number }>
  }
}

/**
 * Factory function to create a product repository with server context
 */
export async function createProductRepository(): Promise<ProductRepository> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Authentication required')
  
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()
    
  if (!profile?.organization_id) throw new Error('User must belong to an organization')
  
  const repository = new ProductRepository(supabase, {
    userId: user.id,
    organizationId: profile.organization_id
  })
  
  return repository
}
```

#### 1.2 Product Service
```typescript
// lib/services/product.service.ts
import { BaseService } from '@/lib/base/base-service'
import { ProductRepository, type Product, type CreateProductInput, type UpdateProductInput } from '@/lib/repositories/product.repository'
import { z } from 'zod'

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().min(1).max(100),
  description: z.string().optional(),
  category_id: z.string().uuid().optional(),
  unit_of_measure: z.string().default('EA'),
  active: z.boolean().default(true),
  metadata: z.record(z.any()).optional()
})

const updateProductSchema = createProductSchema.partial()

export class ProductService extends BaseService {
  constructor(private repository: ProductRepository) {
    super({
      serviceName: 'ProductService',
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerEnabled: true,
      timeoutMs: 30000
    })
  }

  /**
   * Create a new product with validation
   */
  async createProduct(input: CreateProductInput): Promise<Product> {
    return this.execute(async () => {
      // Validate input
      const validated = this.validateInput<CreateProductInput>(input)
      
      // Check for duplicate SKU
      const existing = await this.repository.findBySku(validated.sku)
      if (existing) {
        throw new Error(`Product with SKU ${validated.sku} already exists`)
      }
      
      // Create product
      const product = await this.repository.create(validated)
      
      this.log('info', 'Product created', { productId: product.id, sku: product.sku })
      
      return product
    })
  }

  /**
   * Update a product
   */
  async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    return this.execute(async () => {
      // Validate input
      const validated = this.validateInput<UpdateProductInput>(input)
      
      // Check if product exists
      const existing = await this.repository.findById(id)
      if (!existing) {
        throw new Error(`Product ${id} not found`)
      }
      
      // If SKU is being changed, check for duplicates
      if (validated.sku && validated.sku !== existing.sku) {
        const duplicate = await this.repository.findBySku(validated.sku)
        if (duplicate) {
          throw new Error(`Product with SKU ${validated.sku} already exists`)
        }
      }
      
      // Update product
      const product = await this.repository.update(id, validated)
      
      this.log('info', 'Product updated', { productId: product.id })
      
      return product
    })
  }

  /**
   * Sync products from external system
   */
  async syncProducts(externalProducts: any[]): Promise<{
    created: number
    updated: number
    errors: Array<{ sku: string; error: string }>
  }> {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as Array<{ sku: string; error: string }>
    }

    // Process in batches with parallel execution
    await this.batchExecute(
      externalProducts,
      async (batch) => {
        const operations = batch.map(async (externalProduct) => {
          try {
            const productData = this.transformExternalProduct(externalProduct)
            
            // Check if product exists
            const existing = await this.repository.findBySku(productData.sku)
            
            if (existing) {
              await this.repository.update(existing.id, productData)
              results.updated++
            } else {
              await this.repository.create(productData)
              results.created++
            }
          } catch (error) {
            results.errors.push({
              sku: externalProduct.sku || 'unknown',
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        })
        
        await Promise.all(operations)
        return []
      },
      50 // Process 50 products at a time
    )

    this.log('info', 'Product sync completed', results)
    
    return results
  }

  /**
   * Get products requiring inventory update
   */
  async getProductsForInventoryCheck(): Promise<Product[]> {
    return this.execute(async () => {
      // Get all active products
      const products = await this.repository.findAll({ active: true })
      
      // Filter products that haven't been checked in 24 hours
      const cutoff = new Date()
      cutoff.setHours(cutoff.getHours() - 24)
      
      return products.filter(product => {
        const lastChecked = product.metadata?.last_inventory_check as string
        if (!lastChecked) return true
        return new Date(lastChecked) < cutoff
      })
    })
  }

  /**
   * Validate input data
   */
  protected validateInput<T>(data: unknown): T {
    if ((data as any).id !== undefined) {
      // Update operation
      return updateProductSchema.parse(data) as T
    } else {
      // Create operation
      return createProductSchema.parse(data) as T
    }
  }

  /**
   * Transform external product data to our format
   */
  private transformExternalProduct(external: any): CreateProductInput {
    return {
      name: external.name || external.title,
      sku: external.sku || external.variant_sku,
      description: external.description || external.body_html,
      unit_of_measure: external.unit || 'EA',
      active: external.status === 'active',
      metadata: {
        external_id: external.id,
        external_source: external.source || 'unknown',
        last_synced: new Date().toISOString()
      }
    }
  }

  /**
   * Health check
   */
  protected async runHealthCheck(): Promise<boolean> {
    try {
      // Try to count products
      const count = await this.repository.count()
      return count >= 0
    } catch {
      return false
    }
  }
}

/**
 * Factory function to create a product service
 */
export async function createProductService(): Promise<ProductService> {
  const repository = await createProductRepository()
  return new ProductService(repository)
}
```

### Phase 2: Inventory Management

#### 2.1 Inventory Repository
```typescript
// lib/repositories/inventory.repository.ts
import { BaseRepository } from '@/lib/base/base-repository'
import type { Database } from '@/types/database.types'

export type Inventory = Database['public']['Tables']['inventory']['Row']
export type CreateInventoryInput = Omit<
  Database['public']['Tables']['inventory']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'organization_id'
>

export class InventoryRepository extends BaseRepository<Inventory> {
  private userId: string | null = null
  private organizationId: string | null = null

  constructor(supabase: any, context?: { userId?: string; organizationId?: string }) {
    super(supabase, { tableName: 'inventory' })
    this.userId = context?.userId || null
    this.organizationId = context?.organizationId || null
  }

  protected getOrganizationId(): string | null {
    return this.organizationId
  }

  protected getCurrentUserId(): string | null {
    return this.userId
  }

  /**
   * Get inventory for a specific product across all warehouses
   */
  async getByProductId(productId: string): Promise<Inventory[]> {
    const { data, error } = await this.query()
      .select(`
        *,
        warehouses (
          id,
          name,
          code
        )
      `)
      .eq('product_id', productId)
      .order('quantity', { ascending: false })

    if (error) throw this.handleError(error)
    return (data || []) as Inventory[]
  }

  /**
   * Get total available quantity for a product
   */
  async getTotalQuantity(productId: string): Promise<number> {
    const { data, error } = await this.query()
      .select('quantity')
      .eq('product_id', productId)

    if (error) throw this.handleError(error)
    
    return (data || []).reduce((total, inv) => total + (inv.quantity || 0), 0)
  }

  /**
   * Update inventory quantity with audit trail
   */
  async adjustQuantity(
    productId: string,
    warehouseId: string,
    adjustment: number,
    reason: string
  ): Promise<Inventory> {
    // Get current inventory
    const { data: current } = await this.query()
      .select('*')
      .eq('product_id', productId)
      .eq('warehouse_id', warehouseId)
      .single()

    const newQuantity = (current?.quantity || 0) + adjustment

    if (newQuantity < 0) {
      throw new Error(`Insufficient inventory. Available: ${current?.quantity || 0}, Requested: ${Math.abs(adjustment)}`)
    }

    // Update or create inventory record
    if (current) {
      return await this.update(current.id, {
        quantity: newQuantity,
        last_adjusted: new Date().toISOString(),
        adjustment_reason: reason
      })
    } else {
      return await this.create({
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: newQuantity,
        last_adjusted: new Date().toISOString(),
        adjustment_reason: reason
      })
    }
  }

  /**
   * Transfer inventory between warehouses
   */
  async transfer(
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number
  ): Promise<{ from: Inventory; to: Inventory }> {
    // Decrease from source warehouse
    const from = await this.adjustQuantity(
      productId,
      fromWarehouseId,
      -quantity,
      `Transfer to warehouse ${toWarehouseId}`
    )

    // Increase in destination warehouse
    const to = await this.adjustQuantity(
      productId,
      toWarehouseId,
      quantity,
      `Transfer from warehouse ${fromWarehouseId}`
    )

    return { from, to }
  }
}
```

#### 2.2 Inventory Service
```typescript
// lib/services/inventory.service.ts
import { BaseService } from '@/lib/base/base-service'
import { InventoryRepository } from '@/lib/repositories/inventory.repository'
import { EventEmitter } from 'events'

export interface InventoryAdjustment {
  productId: string
  warehouseId: string
  adjustment: number
  reason: string
  reference?: string
}

export class InventoryService extends BaseService {
  private events = new EventEmitter()

  constructor(private repository: InventoryRepository) {
    super({
      serviceName: 'InventoryService',
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerEnabled: true
    })
  }

  /**
   * Check availability for an order
   */
  async checkAvailability(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<{
    available: boolean
    items: Array<{
      productId: string
      requested: number
      available: number
      sufficient: boolean
    }>
  }> {
    return this.execute(async () => {
      const availability = await Promise.all(
        items.map(async (item) => {
          const total = await this.repository.getTotalQuantity(item.productId)
          return {
            productId: item.productId,
            requested: item.quantity,
            available: total,
            sufficient: total >= item.quantity
          }
        })
      )

      const allAvailable = availability.every(item => item.sufficient)

      return {
        available: allAvailable,
        items: availability
      }
    })
  }

  /**
   * Reserve inventory for an order
   */
  async reserveInventory(
    orderId: string,
    items: Array<{ productId: string; warehouseId: string; quantity: number }>
  ): Promise<void> {
    return this.execute(async () => {
      // Process reservations
      for (const item of items) {
        await this.repository.adjustQuantity(
          item.productId,
          item.warehouseId,
          -item.quantity,
          `Reserved for order ${orderId}`
        )

        // Emit event for other systems
        this.events.emit('inventory:reserved', {
          orderId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity
        })
      }

      this.log('info', 'Inventory reserved', { orderId, itemCount: items.length })
    })
  }

  /**
   * Sync inventory from external system
   */
  async syncFromExternal(
    externalInventory: Array<{
      sku: string
      warehouseCode: string
      quantity: number
    }>
  ): Promise<{
    updated: number
    errors: Array<{ sku: string; error: string }>
  }> {
    const results = {
      updated: 0,
      errors: [] as Array<{ sku: string; error: string }>
    }

    // Process in parallel batches
    await this.parallelExecute(
      externalInventory,
      async (item) => {
        try {
          // Look up product and warehouse IDs
          // This would normally query the database
          const productId = await this.getProductIdBySku(item.sku)
          const warehouseId = await this.getWarehouseIdByCode(item.warehouseCode)

          // Update inventory to match external system
          await this.repository.adjustQuantity(
            productId,
            warehouseId,
            item.quantity,
            'Sync from external system'
          )

          results.updated++
        } catch (error) {
          results.errors.push({
            sku: item.sku,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      },
      10 // Process 10 items concurrently
    )

    this.log('info', 'Inventory sync completed', results)
    return results
  }

  /**
   * Get low stock alerts
   */
  async getLowStockProducts(threshold = 10): Promise<Array<{
    productId: string
    productName: string
    totalQuantity: number
    warehouses: Array<{ id: string; name: string; quantity: number }>
  }>> {
    return this.execute(async () => {
      // This would normally join with products table
      const lowStockItems = await this.repository.findAll()
      
      // Group by product and sum quantities
      const productMap = new Map<string, any>()
      
      for (const item of lowStockItems) {
        if (!productMap.has(item.product_id)) {
          productMap.set(item.product_id, {
            productId: item.product_id,
            totalQuantity: 0,
            warehouses: []
          })
        }
        
        const product = productMap.get(item.product_id)
        product.totalQuantity += item.quantity || 0
        product.warehouses.push({
          id: item.warehouse_id,
          quantity: item.quantity || 0
        })
      }
      
      // Filter to only low stock
      return Array.from(productMap.values()).filter(
        product => product.totalQuantity <= threshold
      )
    })
  }

  protected validateInput<T>(data: unknown): T {
    // Implement validation based on operation
    return data as T
  }

  protected async runHealthCheck(): Promise<boolean> {
    try {
      const count = await this.repository.count()
      return count >= 0
    } catch {
      return false
    }
  }

  // Helper methods (would normally query database)
  private async getProductIdBySku(sku: string): Promise<string> {
    // Placeholder - would query products table
    throw new Error('Product lookup not implemented')
  }

  private async getWarehouseIdByCode(code: string): Promise<string> {
    // Placeholder - would query warehouses table
    throw new Error('Warehouse lookup not implemented')
  }
}
```

### Phase 3: Integration Pattern for Existing Code

#### 3.1 Refactoring Server Actions
```typescript
// app/actions/products.ts (BEFORE)
export async function createProduct(formData: FormData) {
  const supabase = createServerClient()
  
  // Manual validation
  const name = formData.get('name')
  if (!name) throw new Error('Name required')
  
  // Direct database call
  const { data, error } = await supabase
    .from('products')
    .insert({ name, /* ... */ })
    .single()
    
  if (error) throw error
  return data
}

// app/actions/products.ts (AFTER)
export async function createProduct(formData: FormData) {
  const productService = await createProductService()
  
  const input = {
    name: formData.get('name') as string,
    sku: formData.get('sku') as string,
    description: formData.get('description') as string,
    // ... other fields
  }
  
  // Service handles validation, retry, monitoring
  const product = await productService.createProduct(input)
  
  revalidatePath('/products')
  return product
}
```

#### 3.2 Refactoring API Routes
```typescript
// app/api/products/route.ts (AFTER)
import { createRouteHandler } from '@/lib/api/route-handler'
import { createProductService } from '@/lib/services/product.service'

export const GET = createRouteHandler(
  async ({ query, user }) => {
    const productService = await createProductService()
    
    if (query?.search) {
      const products = await productService.searchProducts(query.search)
      return NextResponse.json({ data: products })
    }
    
    const products = await productService.getAllProducts()
    return NextResponse.json({ data: products })
  },
  {
    schema: {
      query: z.object({
        search: z.string().optional(),
        limit: z.coerce.number().optional()
      })
    },
    rateLimit: { requests: 100, window: '1m' }
  }
)
```

### Implementation Strategy

1. **Start with Read Operations**: Lower risk, no data mutations
2. **Add Service Layer**: Wrap existing logic in services
3. **Gradual Repository Adoption**: Replace direct Supabase calls
4. **Feature Flag Rollout**: Toggle between old and new implementations
5. **Monitor and Adjust**: Track performance and errors

### Testing Strategy

```typescript
// __tests__/services/product.service.test.ts
describe('ProductService', () => {
  let service: ProductService
  let repository: jest.Mocked<ProductRepository>

  beforeEach(() => {
    repository = createMockRepository()
    service = new ProductService(repository)
  })

  it('should retry on transient errors', async () => {
    repository.create
      .mockRejectedValueOnce(new Error('Connection timeout'))
      .mockResolvedValueOnce(mockProduct)

    const result = await service.createProduct(validInput)

    expect(repository.create).toHaveBeenCalledTimes(2)
    expect(result).toEqual(mockProduct)
  })

  it('should not retry on validation errors', async () => {
    await expect(
      service.createProduct({ name: '' })
    ).rejects.toThrow('Validation failed')

    expect(repository.create).not.toHaveBeenCalled()
  })
})
```

## Validation

### Automated Checks
```bash
# Run after implementation
npm run test:services
npm run test:repositories
npm run test:integration
```

### Performance Benchmarks
- Service method calls < 100ms p95
- Repository queries < 50ms p95
- Circuit breaker opens after 50% error rate
- Retry backoff working correctly

## Success Criteria

- [ ] All major domain areas have service + repository implementations
- [ ] 100% of services extend BaseService
- [ ] 100% of repositories extend BaseRepository
- [ ] Organization isolation verified on all queries
- [ ] Retry logic working for transient failures
- [ ] Circuit breakers preventing cascade failures
- [ ] Monitoring metrics being collected
- [ ] All tests passing
- [ ] No regression in functionality

## Dependencies

- PRP-018A must be completed (base classes exist)
- Database schema must include audit fields
- Supabase RLS policies must be configured

## Implementation Order

1. **Product domain** (2 days) - Core business logic
2. **Inventory domain** (2 days) - Critical for operations
3. **Pricing domain** (1 day) - Depends on products
4. **Integration domain** (1 day) - External systems
5. **Remaining domains** (2 days) - Lower priority

Total: ~8 days for complete implementation