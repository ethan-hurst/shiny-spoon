'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { validateCsrfToken } from '@/lib/security/csrf'

const shopifyConfigSchema = z.object({
  shop_domain: z.string()
    .min(1, 'Shop domain is required')
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/,
      'Must be a valid Shopify domain (e.g., mystore.myshopify.com)'
    ),
  access_token: z.string().min(1, 'Access token is required'),
  webhook_secret: z.string().min(1, 'Webhook secret is required'),
  sync_products: z.boolean().default(true),
  sync_inventory: z.boolean().default(true),
  sync_orders: z.boolean().default(true),
  sync_customers: z.boolean().default(true),
  b2b_catalog_enabled: z.boolean().default(false),
  sync_frequency: z.number().min(5).max(1440).default(15)
})

export async function createShopifyIntegration(formData: FormData) {
  // Validate CSRF token
  await validateCsrfToken()
  
  const supabase = await createClient()
  
  // Get the current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('Organization not found')
  }

  // Parse and validate input
  const rawData = {
    shop_domain: formData.get('shop_domain'),
    access_token: formData.get('access_token'),
    webhook_secret: formData.get('webhook_secret'),
    sync_products: formData.get('sync_products') === 'true',
    sync_inventory: formData.get('sync_inventory') === 'true',
    sync_orders: formData.get('sync_orders') === 'true',
    sync_customers: formData.get('sync_customers') === 'true',
    b2b_catalog_enabled: formData.get('b2b_catalog_enabled') === 'true',
    sync_frequency: parseInt(formData.get('sync_frequency') as string || '15')
  }

  const validatedData = shopifyConfigSchema.parse(rawData)

  // Use RPC for atomic creation
  const { data: integrationId, error: rpcError } = await supabase
    .rpc('create_shopify_integration', {
      p_organization_id: profile.organization_id,
      p_shop_domain: validatedData.shop_domain,
      p_sync_frequency: validatedData.sync_frequency,
      p_sync_products: validatedData.sync_products,
      p_sync_inventory: validatedData.sync_inventory,
      p_sync_orders: validatedData.sync_orders,
      p_sync_customers: validatedData.sync_customers,
      p_b2b_catalog_enabled: validatedData.b2b_catalog_enabled,
      p_access_token: validatedData.access_token,
      p_storefront_access_token: validatedData.storefront_access_token || null
    })

  if (rpcError) {
    throw new Error(`Failed to create integration: ${rpcError.message}`)
  }

  revalidatePath('/integrations')
  revalidatePath('/integrations/shopify')
  
  return { integrationId }
}

export async function updateShopifyIntegration(integrationId: string, formData: FormData) {
  // Validate CSRF token
  await validateCsrfToken()
  
  const supabase = await createClient()
  
  // Get the current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // Verify user has access to this integration
  const { data: integration, error: integrationError } = await supabase
    .from('integrations')
    .select('organization_id')
    .eq('id', integrationId)
    .single()

  if (integrationError || !integration) {
    throw new Error('Integration not found')
  }

  // Verify user belongs to the organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', integration.organization_id)
    .single()

  if (profileError || !profile) {
    throw new Error('Unauthorized')
  }

  // Parse and validate input
  const rawData = {
    shop_domain: formData.get('shop_domain'),
    access_token: formData.get('access_token'),
    webhook_secret: formData.get('webhook_secret'),
    sync_products: formData.get('sync_products') === 'true',
    sync_inventory: formData.get('sync_inventory') === 'true',
    sync_orders: formData.get('sync_orders') === 'true',
    sync_customers: formData.get('sync_customers') === 'true',
    b2b_catalog_enabled: formData.get('b2b_catalog_enabled') === 'true',
    sync_frequency: parseInt(formData.get('sync_frequency') as string || '15')
  }

  const validatedData = shopifyConfigSchema.parse(rawData)

  // Update integration config
  const { error: updateIntegrationError } = await supabase
    .from('integrations')
    .update({
      config: {
        sync_frequency: validatedData.sync_frequency,
        api_version: '2024-01'
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', integrationId)
    .eq('organization_id', integration.organization_id)

  if (updateIntegrationError) {
    throw new Error(`Failed to update integration: ${updateIntegrationError.message}`)
  }

  // Update Shopify config
  const { error: configError } = await supabase
    .from('shopify_config')
    .update({
      shop_domain: validatedData.shop_domain,
      sync_products: validatedData.sync_products,
      sync_inventory: validatedData.sync_inventory,
      sync_orders: validatedData.sync_orders,
      sync_customers: validatedData.sync_customers,
      b2b_catalog_enabled: validatedData.b2b_catalog_enabled,
      updated_at: new Date().toISOString()
    })
    .eq('integration_id', integrationId)

  if (configError) {
    throw new Error(`Failed to update config: ${configError.message}`)
  }

  // Update credentials if provided
  if (validatedData.access_token || validatedData.webhook_secret) {
    // First fetch existing credentials to preserve data
    const { data: existingCreds, error: fetchError } = await supabase
      .from('integration_credentials')
      .select('credentials')
      .eq('integration_id', integrationId)
      .single()
    
    if (fetchError) {
      throw new Error(`Failed to fetch existing credentials: ${fetchError.message}`)
    }
    
    // Merge existing credentials with new ones
    const updatedCredentials = {
      ...(existingCreds?.credentials || {}),
    }
    
    // Only update fields that have new values
    if (validatedData.access_token) {
      updatedCredentials.access_token = validatedData.access_token
    }
    if (validatedData.webhook_secret) {
      updatedCredentials.webhook_secret = validatedData.webhook_secret
    }
    
    // Update with merged credentials
    const { error: credError } = await supabase
      .from('integration_credentials')
      .update({
        credentials: updatedCredentials,
        updated_at: new Date().toISOString()
      })
      .eq('integration_id', integrationId)

    if (credError) {
      throw new Error(`Failed to update credentials: ${credError.message}`)
    }
  }

  revalidatePath('/integrations')
  revalidatePath('/integrations/shopify')
  
  return { integrationId }
}

export async function updateShopifySyncSettings(
  integrationId: string, 
  settings: {
    sync_products: boolean
    sync_inventory: boolean
    sync_orders: boolean
    sync_customers: boolean
    b2b_catalog_enabled: boolean
    sync_frequency: number
    batch_size: number
  }
) {
  // Validate CSRF token
  await validateCsrfToken()
  const supabase = await createClient()
  
  // Get the current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // Verify user has access to this integration
  const { data: integration, error: integrationError } = await supabase
    .from('integrations')
    .select('organization_id')
    .eq('id', integrationId)
    .single()

  if (integrationError || !integration) {
    throw new Error('Integration not found')
  }

  // Verify user belongs to the organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', integration.organization_id)
    .single()

  if (profileError || !profile) {
    throw new Error('Unauthorized')
  }

  // Update integration config
  const { error: updateIntegrationError } = await supabase
    .from('integrations')
    .update({
      config: {
        sync_frequency: settings.sync_frequency,
        batch_size: settings.batch_size,
        api_version: '2024-01'
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', integrationId)
    .eq('organization_id', integration.organization_id)

  if (updateIntegrationError) {
    throw new Error(`Failed to update integration: ${updateIntegrationError.message}`)
  }

  // Update Shopify config
  const { error: configError } = await supabase
    .from('shopify_config')
    .update({
      sync_products: settings.sync_products,
      sync_inventory: settings.sync_inventory,
      sync_orders: settings.sync_orders,
      sync_customers: settings.sync_customers,
      b2b_catalog_enabled: settings.b2b_catalog_enabled,
      updated_at: new Date().toISOString()
    })
    .eq('integration_id', integrationId)

  if (configError) {
    throw new Error(`Failed to update config: ${configError.message}`)
  }

  revalidatePath('/integrations')
  revalidatePath('/integrations/shopify')
  
  return { success: true }
}