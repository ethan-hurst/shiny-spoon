// PRP-014: Shopify B2B Connector Implementation
import crypto from 'crypto'
import { 
  BaseConnector, 
  type ConnectorConfig, 
  type SyncOptions, 
  type SyncResult 
} from '../base-connector'
import { IntegrationPlatform, type IntegrationPlatformType } from '@/types/integration.types'
import { ShopifyApiClient } from './api-client'
import { BulkOperationManager } from './bulk-operations'
import { PricingManager } from './pricing-manager'
import { ShopifyTransformers } from './transformers'
import type { 
  ShopifyIntegrationConfig,
  ShopifyProduct,
  ShopifyInventoryLevel,
  ShopifyWebhookTopic,
  ShopifySyncResult
} from '@/types/shopify.types'
import { createClient } from '@/lib/supabase/server'

export class ShopifyConnector extends BaseConnector {
  get platform(): IntegrationPlatformType {
    return IntegrationPlatform.SHOPIFY
  }

  private client: ShopifyApiClient
  private transformers: ShopifyTransformers
  private bulkManager: BulkOperationManager
  private pricingManager: PricingManager
  private shopDomain: string
  private webhookSecret: string

  constructor(config: ConnectorConfig) {
    super(config)

    // Decrypt and extract credentials
    const credentials = this.parseCredentials(config.credentials)
    const settings = config.settings as ShopifyIntegrationConfig

    this.shopDomain = settings.shop_domain
    this.webhookSecret = credentials.webhook_secret

    // Initialize API client
    this.client = new ShopifyApiClient({
      shop: this.shopDomain,
      accessToken: credentials.access_token,
      apiVersion: settings.api_version || '2024-01',
      rateLimiter: this.rateLimiter
    })

    // Initialize helpers
    this.transformers = new ShopifyTransformers(settings.location_mappings)
    this.bulkManager = new BulkOperationManager(this.client, this.config.integrationId)
    this.pricingManager = new PricingManager(
      this.client, 
      this.config.integrationId,
      this.config.organizationId
    )
  }

  /**
   * Parse and decrypt credentials
   */
  private parseCredentials(credentials: any): {
    access_token: string
    webhook_secret: string
    storefront_access_token?: string
  } {
    // In production, this would decrypt the credentials
    // For now, we assume they're already decrypted
    return {
      access_token: credentials.access_token,
      webhook_secret: credentials.webhook_secret,
      storefront_access_token: credentials.storefront_access_token
    }
  }

  /**
   * Authenticate with Shopify
   */
  async authenticate(): Promise<void> {
    try {
      // Test API connection by fetching shop info
      const query = `
        query {
          shop {
            id
            name
            email
            plan {
              displayName
            }
            features {
              storefront
              b2b
            }
          }
        }
      `

      const response = await this.client.query<{ shop: any }>(query)

      if (!response.data?.shop) {
        throw new Error('Failed to authenticate with Shopify')
      }

      this.logger.info('Authenticated with Shopify', {
        shop: response.data.shop.name,
        plan: response.data.shop.plan.displayName
      })

      this.emit('authenticated', {
        integrationId: this.config.integrationId,
        shop: response.data.shop.name
      })
    } catch (error) {
      this.handleError(error, 'Authentication failed')
    }
  }

  /**
   * Test connection to Shopify
   */
  async testConnection(): Promise<boolean> {
    try {
      const query = `
        query {
          shop {
            id
          }
        }
      `

      const response = await this.client.query<{ shop: { id: string } }>(query)
      return !!response.data?.shop?.id
    } catch (error) {
      this.logger.error('Connection test failed', error)
      return false
    }
  }

  /**
   * Sync products from Shopify
   */
  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Error[] = []

      try {
        await this.authenticate()

        // Check if we should do bulk sync
        const syncState = await this.getSyncState('product')
        const shouldBulkSync = options?.force || !syncState?.last_sync_at

        if (shouldBulkSync) {
          // Use bulk operation for initial/full sync
          this.logger.info('Starting bulk product sync')
          return await this.bulkSyncProducts(options)
        }

        // Incremental sync using cursor pagination
        this.logger.info('Starting incremental product sync')
        let cursor = syncState?.sync_cursor
        let hasNextPage = true

        while (hasNextPage && (!options?.signal?.aborted)) {
          const query = `
            query GetProducts($cursor: String) {
              products(first: ${options?.limit || 50}, after: $cursor) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                edges {
                  node {
                    ${ShopifyApiClient.buildProductQuery()}
                  }
                }
              }
            }
          `

          const result = await this.withRateLimit(
            () => this.client.query(query, { cursor })
          )

          const products = result.data?.products
          if (!products) break

          hasNextPage = products.pageInfo.hasNextPage
          cursor = products.pageInfo.endCursor

          // Process products
          for (const edge of products.edges) {
            try {
              if (options?.dryRun) {
                this.logger.info('Dry run: Would sync product', {
                  id: edge.node.id,
                  title: edge.node.title
                })
              } else {
                const transformed = this.transformers.transformProduct(edge.node)
                await this.saveProduct(transformed)
                await this.saveProductMapping(edge.node.id, transformed.id)
              }
              totalProcessed++

              // Emit progress
              if (totalProcessed % 10 === 0) {
                this.emitProgress(totalProcessed, totalProcessed + (hasNextPage ? 50 : 0))
              }
            } catch (error) {
              totalFailed++
              errors.push(error as Error)
              this.logger.error('Failed to sync product', {
                productId: edge.node.id,
                error
              })
            }
          }

          // Save cursor for resume capability
          if (!options?.dryRun) {
            await this.saveSyncCursor('product', cursor)
          }

          // Check if we should stop
          if (options?.limit && totalProcessed >= options.limit) {
            break
          }
        }

        // Update sync state
        if (!options?.dryRun) {
          await this.updateSyncState('product', {
            last_sync_at: new Date(),
            total_synced: totalProcessed,
            total_failed: totalFailed,
            last_error: errors.length > 0 ? errors[0].message : null
          })
        }

        const duration = Date.now() - startTime
        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          duration_ms: duration,
          errors: errors.map(e => ({ message: e.message, code: 'SYNC_ERROR' }))
        }
      } catch (error) {
        this.handleError(error, 'Product sync failed')
        throw error
      }
    })
  }

  /**
   * Sync inventory from Shopify
   */
  async syncInventory(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Error[] = []

      try {
        await this.authenticate()

        // Get location mappings
        const settings = this.config.settings as ShopifyIntegrationConfig
        const locationMappings = settings.location_mappings || {}

        if (Object.keys(locationMappings).length === 0) {
          throw new Error('No location mappings configured')
        }

        // Process each location
        for (const [shopifyLocationId, warehouseId] of Object.entries(locationMappings)) {
          if (options?.signal?.aborted) break

          let cursor: string | null = null
          let hasNextPage = true

          while (hasNextPage) {
            const query = `
              query GetInventoryLevels($locationId: ID!, $cursor: String) {
                location(id: $locationId) {
                  id
                  name
                  inventoryLevels(first: ${options?.limit || 250}, after: $cursor) {
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                    edges {
                      node {
                        ${ShopifyApiClient.buildInventoryQuery()}
                      }
                    }
                  }
                }
              }
            `

            const result = await this.withRateLimit(
              () => this.client.query(query, {
                locationId: shopifyLocationId,
                cursor
              })
            )

            const location = result.data?.location
            if (!location) {
              this.logger.warn('Location not found', { locationId: shopifyLocationId })
              break
            }

            const inventoryLevels = location.inventoryLevels
            hasNextPage = inventoryLevels.pageInfo.hasNextPage
            cursor = inventoryLevels.pageInfo.endCursor

            // Process inventory levels
            for (const edge of inventoryLevels.edges) {
              try {
                if (options?.dryRun) {
                  this.logger.info('Dry run: Would sync inventory', {
                    sku: edge.node.item.sku,
                    available: edge.node.available
                  })
                } else {
                  const transformed = this.transformers.transformInventory(
                    edge.node,
                    warehouseId
                  )
                  await this.updateInventory(transformed)
                }
                totalProcessed++
              } catch (error) {
                totalFailed++
                errors.push(error as Error)
                this.logger.error('Failed to sync inventory level', {
                  inventoryItemId: edge.node.item.id,
                  error
                })
              }
            }

            // Check limit
            if (options?.limit && totalProcessed >= options.limit) {
              hasNextPage = false
            }
          }
        }

        // Update sync state
        if (!options?.dryRun) {
          await this.updateSyncState('inventory', {
            last_sync_at: new Date(),
            total_synced: totalProcessed,
            total_failed: totalFailed
          })
        }

        const duration = Date.now() - startTime
        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          duration_ms: duration,
          errors: errors.map(e => ({ message: e.message, code: 'SYNC_ERROR' }))
        }
      } catch (error) {
        this.handleError(error, 'Inventory sync failed')
        throw error
      }
    })
  }

  /**
   * Sync pricing - B2B catalogs and price lists
   */
  async syncPricing(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      try {
        await this.authenticate()

        // Check if store has B2B features
        const storeInfo = await this.getStoreInfo()
        if (!storeInfo.hasB2B) {
          this.logger.info('Store does not have B2B features enabled')
          return {
            success: true,
            items_processed: 0,
            items_failed: 0,
            duration_ms: 0,
            errors: []
          }
        }

        // Sync B2B catalogs and price lists
        return await this.pricingManager.syncCatalogs(options)
      } catch (error) {
        this.handleError(error, 'Pricing sync failed')
        throw error
      }
    })
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhook(headers: Headers, body: string): Promise<boolean> {
    const hmac = headers.get('x-shopify-hmac-sha256')
    if (!hmac) return false

    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body, 'utf8')
      .digest('base64')

    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash))
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(topic: ShopifyWebhookTopic, body: any): Promise<void> {
    const supabase = await createClient()

    // Store webhook for processing
    const { data: webhook, error } = await supabase
      .from('shopify_webhook_events')
      .insert({
        integration_id: this.config.integrationId,
        event_id: body.webhook_id || body.id || crypto.randomUUID(),
        topic,
        shop_domain: this.shopDomain,
        api_version: body.api_version || '2024-01',
        payload: body,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      this.logger.error('Failed to store webhook', { error })
      throw error
    }

    // Process based on topic
    try {
      switch (topic) {
        case 'products/create':
        case 'products/update':
          await this.processProductWebhook(webhook.id, body)
          break

        case 'inventory_levels/update':
          await this.processInventoryWebhook(webhook.id, body)
          break

        case 'orders/create':
          await this.processOrderWebhook(webhook.id, body)
          break

        case 'bulk_operations/finish':
          await this.bulkManager.handleBulkOperationWebhook(body)
          break

        default:
          this.logger.warn(`Unhandled webhook topic: ${topic}`)
      }

      await this.updateWebhookStatus(webhook.id, 'completed')
    } catch (error) {
      await this.updateWebhookStatus(webhook.id, 'failed', (error as Error).message)
      throw error
    }
  }

  /**
   * Private helper methods
   */

  private async bulkSyncProducts(options?: SyncOptions): Promise<SyncResult> {
    const operation = await this.bulkManager.createBulkQuery(`
      {
        products {
          edges {
            node {
              ${ShopifyApiClient.buildProductQuery()}
            }
          }
        }
      }
    `)

    // Wait for completion
    const result = await this.bulkManager.waitForCompletion(operation.id)

    if (result.status === 'COMPLETED' && result.url) {
      // Process JSONL file
      return await this.bulkManager.processResults(
        result.url,
        async (product: ShopifyProduct) => {
          if (options?.dryRun) {
            this.logger.info('Dry run: Would sync product', {
              id: product.id,
              title: product.title
            })
            return
          }

          const transformed = this.transformers.transformProduct(product)
          await this.saveProduct(transformed)
          await this.saveProductMapping(product.id, transformed.id)
        }
      )
    } else {
      throw new Error(`Bulk operation failed: ${result.errorCode || 'Unknown error'}`)
    }
  }

  private async processProductWebhook(webhookId: string, product: any): Promise<void> {
    try {
      const transformed = this.transformers.transformProduct(product)
      await this.saveProduct(transformed)
      await this.saveProductMapping(product.admin_graphql_api_id || product.id, transformed.id)
    } catch (error) {
      this.logger.error('Failed to process product webhook', { webhookId, error })
      throw error
    }
  }

  private async processInventoryWebhook(webhookId: string, inventory: any): Promise<void> {
    try {
      const settings = this.config.settings as ShopifyIntegrationConfig
      const locationMappings = settings.location_mappings || {}
      const warehouseId = locationMappings[inventory.location_id]

      if (!warehouseId) {
        this.logger.warn('No warehouse mapping for location', {
          locationId: inventory.location_id
        })
        return
      }

      const transformed = this.transformers.transformInventoryFromWebhook(
        inventory,
        warehouseId
      )
      await this.updateInventory(transformed)
    } catch (error) {
      this.logger.error('Failed to process inventory webhook', { webhookId, error })
      throw error
    }
  }

  private async processOrderWebhook(webhookId: string, order: any): Promise<void> {
    try {
      // Emit event for order processing
      this.emit('order:created', {
        integrationId: this.config.integrationId,
        order: this.transformers.transformOrder(order)
      })
    } catch (error) {
      this.logger.error('Failed to process order webhook', { webhookId, error })
      throw error
    }
  }

  private async getStoreInfo(): Promise<{ hasB2B: boolean; plan: string }> {
    const query = `
      query {
        shop {
          plan {
            displayName
          }
          features {
            b2b
          }
        }
      }
    `

    const response = await this.client.query<{
      shop: {
        plan: { displayName: string }
        features: { b2b: boolean }
      }
    }>(query)

    return {
      hasB2B: response.data?.shop.features.b2b || false,
      plan: response.data?.shop.plan.displayName || 'Unknown'
    }
  }

  private async getSyncState(entityType: string): Promise<any> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('shopify_sync_state')
      .select('*')
      .eq('integration_id', this.config.integrationId)
      .eq('entity_type', entityType)
      .single()

    return data
  }

  private async saveSyncCursor(entityType: string, cursor: string | null): Promise<void> {
    const supabase = await createClient()
    await supabase
      .from('shopify_sync_state')
      .upsert({
        integration_id: this.config.integrationId,
        entity_type: entityType,
        sync_cursor: cursor,
        updated_at: new Date().toISOString()
      })
  }

  private async updateSyncState(entityType: string, updates: Record<string, any>): Promise<void> {
    const supabase = await createClient()
    await supabase
      .from('shopify_sync_state')
      .upsert({
        integration_id: this.config.integrationId,
        entity_type: entityType,
        ...updates
      })
  }

  private async saveProduct(product: any): Promise<void> {
    const supabase = await createClient()
    
    // Upsert product to database
    const { error } = await supabase
      .from('products')
      .upsert({
        organization_id: this.config.organizationId,
        name: product.name,
        sku: product.sku,
        description: product.description,
        price: product.price,
        status: product.status,
        external_id: product.external_id,
        updated_at: new Date().toISOString()
      })

    if (error) {
      throw new Error(`Failed to save product: ${error.message}`)
    }
  }

  private async saveProductMapping(shopifyId: string, internalId: string): Promise<void> {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('shopify_product_mapping')
      .upsert({
        integration_id: this.config.integrationId,
        shopify_product_id: shopifyId.split('/').pop(), // Extract ID from GID
        shopify_variant_id: shopifyId,
        internal_product_id: internalId,
        last_synced_at: new Date().toISOString()
      })

    if (error) {
      throw new Error(`Failed to save product mapping: ${error.message}`)
    }
  }

  private async updateInventory(inventory: any): Promise<void> {
    const supabase = await createClient()
    
    // Update inventory in database
    const { error } = await supabase
      .from('inventory')
      .upsert({
        organization_id: this.config.organizationId,
        product_id: inventory.product_id,
        warehouse_id: inventory.warehouse_id,
        quantity: inventory.quantity,
        updated_at: new Date().toISOString()
      })

    if (error) {
      throw new Error(`Failed to update inventory: ${error.message}`)
    }
  }

  private async updateWebhookStatus(
    webhookId: string, 
    status: string, 
    error?: string
  ): Promise<void> {
    const supabase = await createClient()
    
    await supabase
      .from('shopify_webhook_events')
      .update({
        status,
        error,
        processed_at: new Date().toISOString(),
        attempts: status === 'failed' ? 1 : 0
      })
      .eq('id', webhookId)
  }
}