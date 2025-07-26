// PRP-013: NetSuite Connector Implementation
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { 
  BaseConnector, 
  type ConnectorConfig, 
  type SyncOptions, 
  type SyncResult 
} from '../base-connector'
import { 
  IntegrationError,
  AuthenticationError,
  type IntegrationPlatformType 
} from '@/types/integration.types'
import type { NetSuiteIntegrationConfig } from '@/types/netsuite.types'
import { NetSuiteAuth } from './auth'
import { NetSuiteApiClient } from './api-client'
import { NetSuiteQueries } from './queries'
import { NetSuiteTransformers } from './transformers'

export class NetSuiteConnector extends BaseConnector {
  private auth: NetSuiteAuth
  private client: NetSuiteApiClient
  private queries: NetSuiteQueries
  private transformers: NetSuiteTransformers
  private supabase = createClient()
  private netsuiteConfig: NetSuiteIntegrationConfig

  get platform(): IntegrationPlatformType {
    return 'netsuite'
  }

  constructor(config: ConnectorConfig) {
    super(config)
    
    // Parse NetSuite-specific config
    this.netsuiteConfig = config.settings as NetSuiteIntegrationConfig
    
    // Initialize components
    this.auth = new NetSuiteAuth(
      config.integrationId,
      config.organizationId,
      this.netsuiteConfig
    )
    
    this.client = new NetSuiteApiClient(
      this.auth,
      this.netsuiteConfig.account_id,
      this.netsuiteConfig.datacenter_url,
      this.rateLimiter
    )
    
    this.queries = new NetSuiteQueries()
    this.transformers = new NetSuiteTransformers(this.netsuiteConfig.field_mappings)
  }

  async authenticate(): Promise<void> {
    try {
      this.logger.info('Authenticating with NetSuite')
      
      // Initialize auth with stored credentials
      await this.auth.initialize()
      
      // Test authentication by getting a valid token
      await this.auth.getValidAccessToken()
      
      this.emit('authenticated', { integrationId: this.config.integrationId })
      this.logger.info('NetSuite authentication successful')
    } catch (error) {
      this.handleError(error, 'Authentication failed')
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      this.logger.debug('Testing NetSuite connection')
      
      // Execute a simple SuiteQL query to test connectivity
      const result = await this.client.executeSuiteQL(
        'SELECT id FROM item WHERE ROWNUM <= 1'
      )
      
      this.logger.info('NetSuite connection test successful')
      return result.items.length >= 0
    } catch (error) {
      this.logger.error('NetSuite connection test failed', { error })
      return false
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Array<{ item_id?: string; error: string; details?: any }> = []

      try {
        this.logger.info('Starting NetSuite product sync', options)
        
        // Get sync state
        const syncState = await this.getSyncState('product')
        const lastSyncDate = syncState?.last_sync_date || new Date(0)
        
        // Build query with pagination
        let hasMore = true
        let offset = options?.cursor ? parseInt(options.cursor) : 0
        const limit = options?.limit || 1000

        while (hasMore && (!options?.limit || totalProcessed < options.limit)) {
          // Get products query
          const query = this.queries.getProductsQuery({
            modifiedAfter: lastSyncDate,
            limit,
            offset,
          })

          this.logger.debug('Executing product query', { offset, limit })
          
          // Execute query with rate limiting
          const result = await this.withRateLimit(
            () => this.client.executeSuiteQL(query),
            2 // Higher weight for SuiteQL
          )

          if (result.items.length === 0) {
            hasMore = false
            break
          }

          // Process batch
          for (const item of result.items) {
            try {
              // Transform NetSuite item to TruthSource product
              const product = await this.transformers.transformProduct(item)
              
              // Save to database
              await this.saveProduct(product)
              totalProcessed++

              // Emit progress
              if (totalProcessed % 100 === 0) {
                this.emit('sync:progress', {
                  current: totalProcessed,
                  total: -1, // Unknown total
                })
                
                this.logger.debug('Product sync progress', {
                  processed: totalProcessed,
                  failed: totalFailed,
                })
              }
            } catch (error) {
              totalFailed++
              errors.push({
                item_id: item.itemid,
                error: error instanceof Error ? error.message : String(error),
                details: item,
              })
              
              this.logger.error('Failed to sync product', {
                itemId: item.itemid,
                error,
              })
            }
          }

          offset += limit
          hasMore = result.hasMore

          // Check if we should stop due to dry run
          if (options?.dryRun) {
            this.logger.info('Dry run mode - stopping after first batch')
            break
          }
        }

        // Update sync state
        if (!options?.dryRun) {
          await this.updateSyncState('product', {
            last_sync_date: new Date(),
            last_sync_token: offset.toString(),
            total_synced: totalProcessed,
            total_errors: totalFailed,
          })
        }

        const duration = Date.now() - startTime
        this.logger.info('Product sync completed', {
          processed: totalProcessed,
          failed: totalFailed,
          duration,
        })

        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          items_skipped: 0,
          errors,
          next_cursor: hasMore ? offset.toString() : undefined,
        }
      } catch (error) {
        this.handleError(error, 'Product sync failed')
        throw error
      }
    })
  }

  async syncInventory(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Array<{ item_id?: string; error: string; details?: any }> = []

      try {
        this.logger.info('Starting NetSuite inventory sync', options)
        
        // Get all locations first
        const locations = await this.getLocations()
        this.logger.debug(`Found ${locations.length} locations`)

        // Sync inventory for each location
        for (const location of locations) {
          if (!location.makeinventoryavailable) {
            this.logger.debug(`Skipping location ${location.name} - inventory not available`)
            continue
          }

          const query = this.queries.getInventoryQuery({
            locationId: location.id,
            modifiedAfter: options?.filters?.modifiedAfter,
          })

          const result = await this.withRateLimit(
            () => this.client.executeSuiteQL(query)
          )

          for (const item of result.items) {
            try {
              // Transform and save inventory
              const inventory = await this.transformers.transformInventory(item, location)
              await this.updateInventory(inventory)
              totalProcessed++

              if (totalProcessed % 50 === 0) {
                this.emit('sync:progress', {
                  current: totalProcessed,
                  total: -1,
                })
              }
            } catch (error) {
              totalFailed++
              errors.push({
                item_id: item.itemid,
                error: error instanceof Error ? error.message : String(error),
                details: { item, location: location.name },
              })
            }
          }
        }

        // Update sync state
        if (!options?.dryRun) {
          await this.updateSyncState('inventory', {
            last_sync_date: new Date(),
            total_synced: totalProcessed,
            total_errors: totalFailed,
          })
        }

        const duration = Date.now() - startTime
        this.logger.info('Inventory sync completed', {
          processed: totalProcessed,
          failed: totalFailed,
          duration,
        })

        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          items_skipped: 0,
          errors,
        }
      } catch (error) {
        this.handleError(error, 'Inventory sync failed')
        throw error
      }
    })
  }

  async syncPricing(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Array<{ item_id?: string; error: string; details?: any }> = []

      try {
        this.logger.info('Starting NetSuite pricing sync', options)
        
        const query = this.queries.getPricingQuery({
          modifiedAfter: options?.filters?.modifiedAfter,
        })

        const result = await this.withRateLimit(
          () => this.client.executeSuiteQL(query)
        )

        // Group pricing by item
        const pricingByItem = new Map<string, any[]>()
        
        for (const priceRecord of result.items) {
          const itemId = priceRecord.itemid
          if (!pricingByItem.has(itemId)) {
            pricingByItem.set(itemId, [])
          }
          pricingByItem.get(itemId)!.push(priceRecord)
        }

        // Process each item's pricing
        for (const [itemId, prices] of pricingByItem.entries()) {
          try {
            const pricing = await this.transformers.transformPricing(itemId, prices)
            await this.updatePricing(pricing)
            totalProcessed++
          } catch (error) {
            totalFailed++
            errors.push({
              item_id: itemId,
              error: error instanceof Error ? error.message : String(error),
              details: prices,
            })
          }
        }

        // Update sync state
        if (!options?.dryRun) {
          await this.updateSyncState('pricing', {
            last_sync_date: new Date(),
            total_synced: totalProcessed,
            total_errors: totalFailed,
          })
        }

        const duration = Date.now() - startTime
        this.logger.info('Pricing sync completed', {
          processed: totalProcessed,
          failed: totalFailed,
          duration,
        })

        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          items_skipped: 0,
          errors,
        }
      } catch (error) {
        this.handleError(error, 'Pricing sync failed')
        throw error
      }
    })
  }

  // Helper methods
  private async getSyncState(entityType: string) {
    const { data } = await this.supabase
      .from('netsuite_sync_state')
      .select('*')
      .eq('integration_id', this.config.integrationId)
      .eq('entity_type', entityType)
      .single()

    return data
  }

  private async updateSyncState(entityType: string, updates: any) {
    await this.supabase
      .from('netsuite_sync_state')
      .upsert({
        integration_id: this.config.integrationId,
        entity_type: entityType,
        ...updates,
      })
  }

  private async getLocations() {
    const query = `
      SELECT 
        id,
        name,
        isinactive,
        makeinventoryavailable
      FROM location
      WHERE isinactive = 'F'
        AND makeinventoryavailable = 'T'
      ORDER BY name
    `
    
    const result = await this.client.executeSuiteQL(query)
    return result.items
  }

  private async saveProduct(product: any) {
    const { error } = await this.supabase
      .from('products')
      .upsert({
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: product.price,
        weight: product.weight,
        dimensions: product.dimensions,
        is_active: product.is_active,
        external_id: product.external_id,
        external_updated_at: product.external_updated_at,
        metadata: product.metadata,
        organization_id: this.config.organizationId,
      })
      .eq('sku', product.sku)
      .eq('organization_id', this.config.organizationId)

    if (error) throw error
  }

  private async updateInventory(inventory: any) {
    // Find warehouse by code
    const { data: warehouse } = await this.supabase
      .from('warehouses')
      .select('id')
      .eq('code', inventory.warehouse_code)
      .eq('organization_id', this.config.organizationId)
      .single()

    if (!warehouse) {
      throw new Error(`Warehouse not found: ${inventory.warehouse_code}`)
    }

    // Find product by SKU
    const { data: product } = await this.supabase
      .from('products')
      .select('id')
      .eq('sku', inventory.product_sku)
      .eq('organization_id', this.config.organizationId)
      .single()

    if (!product) {
      throw new Error(`Product not found: ${inventory.product_sku}`)
    }

    // Update inventory
    const { error } = await this.supabase
      .from('inventory')
      .upsert({
        product_id: product.id,
        warehouse_id: warehouse.id,
        quantity: inventory.quantity_available,
        reserved_quantity: inventory.quantity_on_order,
        reorder_point: inventory.reorder_point,
        reorder_quantity: inventory.preferred_stock_level,
        last_sync: new Date().toISOString(),
        sync_status: 'synced',
        organization_id: this.config.organizationId,
      })
      .eq('product_id', product.id)
      .eq('warehouse_id', warehouse.id)

    if (error) throw error
  }

  private async updatePricing(pricing: any[]) {
    for (const price of pricing) {
      // Find product by SKU
      const { data: product } = await this.supabase
        .from('products')
        .select('id')
        .eq('sku', price.product_sku)
        .eq('organization_id', this.config.organizationId)
        .single()

      if (!product) {
        this.logger.warn(`Product not found for pricing: ${price.product_sku}`)
        continue
      }

      // Map NetSuite price level to TruthSource price tier
      const priceTier = this.mapPriceLevelToTier(price.price_tier)

      // Update product pricing
      const { error } = await this.supabase
        .from('product_pricing')
        .upsert({
          product_id: product.id,
          price_tier: priceTier,
          unit_price: price.unit_price,
          currency_code: price.currency_code,
          min_quantity: 1,
          external_id: price.external_id,
          external_updated_at: price.external_updated_at,
        })
        .eq('product_id', product.id)
        .eq('price_tier', priceTier)

      if (error) {
        this.logger.error('Failed to update pricing', { error, price })
      }
    }
  }

  private mapPriceLevelToTier(priceLevel: string): string {
    // Map NetSuite price levels to TruthSource tiers
    const mapping: Record<string, string> = {
      'Base Price': 'base',
      'Wholesale': 'wholesale',
      'Retail': 'retail',
      'Special': 'special',
    }
    
    return mapping[priceLevel] || priceLevel.toLowerCase()
  }

  private async withRateLimit<T>(
    fn: () => Promise<T>,
    weight: number = 1
  ): Promise<T> {
    await this.rateLimiter.acquire(weight)
    try {
      return await fn()
    } finally {
      this.rateLimiter.release(weight)
    }
  }

  private handleError(error: unknown, context: string): void {
    const integrationError = error instanceof IntegrationError
      ? error
      : new IntegrationError(
          context,
          'NETSUITE_ERROR',
          error instanceof Error ? error.message : String(error)
        )
    
    this.emit('error', integrationError)
    this.logger.error(context, { 
      error: integrationError.message,
      code: integrationError.code,
      details: integrationError.details,
    })
  }

  // Webhook handling
  async handleWebhook(payload: any): Promise<void> {
    try {
      // Queue webhook for processing to avoid timeout
      await this.supabase.from('netsuite_webhook_events').insert({
        integration_id: this.config.integrationId,
        event_id: payload.eventId,
        event_type: payload.eventType,
        entity_type: payload.recordType,
        entity_id: payload.recordId,
        payload,
        status: 'pending',
      })

      this.logger.info('NetSuite webhook queued for processing', {
        eventId: payload.eventId,
        eventType: payload.eventType,
        recordType: payload.recordType,
      })
    } catch (error) {
      this.logger.error('Failed to queue webhook event', { error, payload })
      throw error
    }
  }
}