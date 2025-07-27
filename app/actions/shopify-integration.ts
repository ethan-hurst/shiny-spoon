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

  // Use RPC for atomic update
  const { error: rpcError } = await supabase
    .rpc('update_shopify_integration', {
      p_integration_id: integrationId,
      p_organization_id: integration.organization_id,
      p_shop_domain: validatedData.shop_domain,
      p_sync_frequency: validatedData.sync_frequency,
      p_sync_products: validatedData.sync_products,
      p_sync_inventory: validatedData.sync_inventory,
      p_sync_orders: validatedData.sync_orders,
      p_sync_customers: validatedData.sync_customers,
      p_b2b_catalog_enabled: validatedData.b2b_catalog_enabled,
      p_access_token: validatedData.access_token || null,
      p_webhook_secret: validatedData.webhook_secret || null
    })

  if (rpcError) {
    throw new Error(`Failed to update integration: ${rpcError.message}`)
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

  // Use RPC for atomic update
  const { error: rpcError } = await supabase
    .rpc('update_shopify_sync_settings', {
      p_integration_id: integrationId,
      p_organization_id: integration.organization_id,
      p_sync_products: settings.sync_products,
      p_sync_inventory: settings.sync_inventory,
      p_sync_orders: settings.sync_orders,
      p_sync_customers: settings.sync_customers,
      p_b2b_catalog_enabled: settings.b2b_catalog_enabled,
      p_sync_frequency: settings.sync_frequency,
      p_batch_size: settings.batch_size
    })

  if (rpcError) {
    throw new Error(`Failed to update sync settings: ${rpcError.message}`)
  }

  revalidatePath('/integrations')
  revalidatePath('/integrations/shopify')
  
  return { success: true }
}