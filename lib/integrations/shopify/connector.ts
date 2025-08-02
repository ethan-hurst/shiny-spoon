// PRP-014: Shopify B2B Connector Implementation
import { 
  BaseConnector, 
  type ConnectorConfig, 
  type SyncResult,
  type WebhookPayload 
} from '@/lib/integrations/base-connector'
import { ShopifyApiClient } from './api-client'
import { transformShopifyProduct, transformShopifyOrder, transformShopifyCustomer } from './transformers'
import type { 
  ShopifyProduct, 
  ShopifyVariant, 
  ShopifyOrder, 
  ShopifyCustomer,
  ShopifyWebhookPayload,
  ShopifyB2BCatalog
} from '@/types/shopify.types'

export class ShopifyConnector extends BaseConnector {
  private apiClient: ShopifyApiClient
  private shopDomain: string

  constructor(config: ConnectorConfig) {
    super(config)
    this.shopDomain = config.settings?.shop_domain || ''
    this.apiClient = new ShopifyApiClient({
      shopDomain: this.shopDomain,
      accessToken: config.credentials?.access_token || '',
      apiVersion: config.settings?.api_version || '2024-01'
    })
  }

  async syncProducts(): Promise<SyncResult> {
    try {
      console.log('Starting Shopify products sync...')
      
      const products = await this.apiClient.getProducts({
        limit: 250,
        status: 'active'
      })

      const transformedProducts = products.map(transformShopifyProduct)
      
      // Store product mappings
      await this.storeProductMappings(products)

      console.log(`Synced ${transformedProducts.length} products from Shopify`)
      
      return {
        success: true,
        syncedCount: transformedProducts.length,
        errors: [],
        data: transformedProducts
      }
    } catch (error) {
      console.error('Shopify products sync failed:', error)
      return {
        success: false,
        syncedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        data: []
      }
    }
  }

  async syncInventory(): Promise<SyncResult> {
    try {
      console.log('Starting Shopify inventory sync...')
      
      const inventoryLevels = await this.apiClient.getInventoryLevels()
      
      // Get product mappings to match inventory to products
      const { data: mappings } = await this.supabase
        .from('shopify_product_mapping')
        .select('shopify_variant_id, internal_product_id')
        .eq('integration_id', this.config.integrationId)

      const inventoryUpdates = inventoryLevels.map(level => {
        const mapping = mappings?.find(m => m.shopify_variant_id === level.inventory_item_id.toString())
        return {
          product_id: mapping?.internal_product_id,
          location_id: level.location_id,
          available: level.available,
          shopify_variant_id: level.inventory_item_id
        }
      }).filter(update => update.product_id)

      console.log(`Synced ${inventoryUpdates.length} inventory levels from Shopify`)
      
      return {
        success: true,
        syncedCount: inventoryUpdates.length,
        errors: [],
        data: inventoryUpdates
      }
    } catch (error) {
      console.error('Shopify inventory sync failed:', error)
      return {
        success: false,
        syncedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        data: []
      }
    }
  }

  async syncOrders(): Promise<SyncResult> {
    try {
      console.log('Starting Shopify orders sync...')
      
      const orders = await this.apiClient.getOrders({
        limit: 250,
        status: 'any',
        financial_status: 'paid'
      })

      const transformedOrders = orders.map(transformShopifyOrder)
      
      console.log(`Synced ${transformedOrders.length} orders from Shopify`)
      
      return {
        success: true,
        syncedCount: transformedOrders.length,
        errors: [],
        data: transformedOrders
      }
    } catch (error) {
      console.error('Shopify orders sync failed:', error)
      return {
        success: false,
        syncedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        data: []
      }
    }
  }

  async syncCustomers(): Promise<SyncResult> {
    try {
      console.log('Starting Shopify customers sync...')
      
      const customers = await this.apiClient.getCustomers({
        limit: 250
      })

      const transformedCustomers = customers.map(transformShopifyCustomer)
      
      console.log(`Synced ${transformedCustomers.length} customers from Shopify`)
      
      return {
        success: true,
        syncedCount: transformedCustomers.length,
        errors: [],
        data: transformedCustomers
      }
    } catch (error) {
      console.error('Shopify customers sync failed:', error)
      return {
        success: false,
        syncedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        data: []
      }
    }
  }

  async syncB2BCatalogs(): Promise<SyncResult> {
    try {
      console.log('Starting Shopify B2B catalogs sync...')
      
      const catalogs = await this.apiClient.getB2BCatalogs()
      
      const transformedCatalogs = catalogs.map(catalog => ({
        id: catalog.id,
        name: catalog.name,
        status: catalog.status,
        price_list_id: catalog.price_list_id,
        customer_tier_id: catalog.customer_tier_id,
        discount_percentage: catalog.discount_percentage
      }))
      
      console.log(`Synced ${transformedCatalogs.length} B2B catalogs from Shopify`)
      
      return {
        success: true,
        syncedCount: transformedCatalogs.length,
        errors: [],
        data: transformedCatalogs
      }
    } catch (error) {
      console.error('Shopify B2B catalogs sync failed:', error)
      return {
        success: false,
        syncedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        data: []
      }
    }
  }

  async verifyWebhook(headers: Headers, payload: string): Promise<boolean> {
    try {
      const signature = headers.get('x-shopify-hmac-sha256')
      if (!signature) {
        console.error('Missing Shopify webhook signature')
        return false
      }

      const webhookSecret = this.config.webhookSecret
      if (!webhookSecret) {
        console.error('Missing webhook secret for verification')
        return false
      }

      // Use Web Crypto API for HMAC verification
      const encoder = new TextEncoder()
      const keyData = encoder.encode(webhookSecret)
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      
      const signatureData = encoder.encode(payload)
      const expectedSignature = await crypto.subtle.sign('HMAC', key, signatureData)
      const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      const isValid = signature === expectedSignatureHex
      
      if (!isValid) {
        console.error('Invalid Shopify webhook signature')
      }
      
      return isValid
    } catch (error) {
      console.error('Webhook verification failed:', error)
      return false
    }
  }

  async handleWebhook(payload: ShopifyWebhookPayload): Promise<void> {
    try {
      console.log('Processing Shopify webhook:', payload.topic)
      
      switch (payload.topic) {
        case 'products/update':
        case 'products/create':
          await this.handleProductWebhook(payload)
          break
          
        case 'inventory_levels/update':
          await this.handleInventoryWebhook(payload)
          break
          
        case 'orders/create':
        case 'orders/updated':
          await this.handleOrderWebhook(payload)
          break
          
        case 'customers/create':
        case 'customers/update':
          await this.handleCustomerWebhook(payload)
          break
          
        default:
          console.log('Unhandled webhook topic:', payload.topic)
      }
    } catch (error) {
      console.error('Webhook handling failed:', error)
      throw error
    }
  }

  private async handleProductWebhook(payload: ShopifyWebhookPayload): Promise<void> {
    const product = payload.body as ShopifyProduct
    console.log('Processing product webhook for:', product.title)
    
    // Transform and sync the product
    const transformedProduct = transformShopifyProduct(product)
    
    // Update product in database
    await this.supabase
      .from('products')
      .upsert({
        id: transformedProduct.id,
        name: transformedProduct.name,
        sku: transformedProduct.sku,
        description: transformedProduct.description,
        base_price: transformedProduct.base_price,
        current_price: transformedProduct.current_price,
        organization_id: this.config.organizationId,
        updated_at: new Date().toISOString()
      })
    
    // Update product mapping
    await this.storeProductMappings([product])
  }

  private async handleInventoryWebhook(payload: ShopifyWebhookPayload): Promise<void> {
    const inventoryLevel = payload.body as any
    console.log('Processing inventory webhook for variant:', inventoryLevel.inventory_item_id)
    
    // Find product mapping
    const { data: mapping } = await this.supabase
      .from('shopify_product_mapping')
      .select('internal_product_id')
      .eq('shopify_variant_id', inventoryLevel.inventory_item_id.toString())
      .eq('integration_id', this.config.integrationId)
      .single()
    
    if (mapping) {
      // Update inventory level
      await this.supabase
        .from('inventory')
        .upsert({
          product_id: mapping.internal_product_id,
          warehouse_id: inventoryLevel.location_id,
          quantity: inventoryLevel.available,
          updated_at: new Date().toISOString()
        })
    }
  }

  private async handleOrderWebhook(payload: ShopifyWebhookPayload): Promise<void> {
    const order = payload.body as ShopifyOrder
    console.log('Processing order webhook for:', order.order_number)
    
    // Transform and sync the order
    const transformedOrder = transformShopifyOrder(order)
    
    // Update order in database
    await this.supabase
      .from('orders')
      .upsert({
        id: transformedOrder.id,
        order_number: transformedOrder.order_number,
        customer_id: transformedOrder.customer_id,
        total_amount: transformedOrder.total_amount,
        status: transformedOrder.status,
        organization_id: this.config.organizationId,
        updated_at: new Date().toISOString()
      })
  }

  private async handleCustomerWebhook(payload: ShopifyWebhookPayload): Promise<void> {
    const customer = payload.body as ShopifyCustomer
    console.log('Processing customer webhook for:', customer.email)
    
    // Transform and sync the customer
    const transformedCustomer = transformShopifyCustomer(customer)
    
    // Update customer in database
    await this.supabase
      .from('customers')
      .upsert({
        id: transformedCustomer.id,
        name: transformedCustomer.name,
        email: transformedCustomer.email,
        phone: transformedCustomer.phone,
        organization_id: this.config.organizationId,
        updated_at: new Date().toISOString()
      })
  }

  private async storeProductMappings(products: ShopifyProduct[]): Promise<void> {
    const mappings = products.flatMap(product => 
      product.variants.map(variant => ({
        integration_id: this.config.integrationId,
        shopify_product_id: product.id.toString(),
        shopify_variant_id: variant.id.toString(),
        internal_product_id: this.generateProductId(product.id, variant.id),
        last_synced_at: new Date().toISOString(),
        shopify_updated_at: product.updated_at
      }))
    )

    if (mappings.length > 0) {
      await this.supabase
        .from('shopify_product_mapping')
        .upsert(mappings, { onConflict: 'integration_id,shopify_variant_id' })
    }
  }

  private generateProductId(shopifyProductId: number, shopifyVariantId: number): string {
    // Generate a deterministic UUID based on Shopify IDs
    const combined = `${shopifyProductId}-${shopifyVariantId}`
    return `shopify-${combined}`
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Test API access
      const shop = await this.apiClient.getShop()
      console.log('Shopify connection test successful:', shop.name)
      
      return { success: true }
    } catch (error) {
      console.error('Shopify connection test failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed' 
      }
    }
  }

  async getSyncStatus(): Promise<any> {
    try {
      const { data: syncStates } = await this.supabase
        .from('shopify_sync_state')
        .select('*')
        .eq('integration_id', this.config.integrationId)
        .order('entity_type')

      return syncStates || []
    } catch (error) {
      console.error('Failed to get sync status:', error)
      return []
    }
  }

  async updateSyncState(entityType: string, syncedCount: number, errors: string[] = []): Promise<void> {
    try {
      await this.supabase
        .from('shopify_sync_state')
        .upsert({
          integration_id: this.config.integrationId,
          entity_type: entityType,
          last_sync_at: new Date().toISOString(),
          total_synced: syncedCount,
          total_failed: errors.length,
          last_error: errors.length > 0 ? errors[0] : null
        }, { onConflict: 'integration_id,entity_type' })
    } catch (error) {
      console.error('Failed to update sync state:', error)
    }
  }
}