-- PRP-016A: Create RPC function for atomic Shopify integration creation

-- Function to atomically create Shopify integration with config
CREATE OR REPLACE FUNCTION create_shopify_integration(
  p_organization_id UUID,
  p_shop_domain TEXT,
  p_sync_frequency TEXT,
  p_sync_products BOOLEAN,
  p_sync_inventory BOOLEAN,
  p_sync_orders BOOLEAN,
  p_sync_customers BOOLEAN,
  p_b2b_catalog_enabled BOOLEAN,
  p_access_token TEXT,
  p_storefront_access_token TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_integration_id UUID;
BEGIN
  -- Create integration
  INSERT INTO integrations (
    organization_id,
    platform,
    name,
    status,
    config
  ) VALUES (
    p_organization_id,
    'shopify',
    'Shopify - ' || p_shop_domain,
    'configuring',
    jsonb_build_object(
      'sync_frequency', p_sync_frequency,
      'api_version', '2024-01'
    )
  ) RETURNING id INTO v_integration_id;
  
  -- Create Shopify config
  INSERT INTO shopify_config (
    integration_id,
    shop_domain,
    sync_products,
    sync_inventory,
    sync_orders,
    sync_customers,
    b2b_catalog_enabled,
    organization_id
  ) VALUES (
    v_integration_id,
    p_shop_domain,
    p_sync_products,
    p_sync_inventory,
    p_sync_orders,
    p_sync_customers,
    p_b2b_catalog_enabled,
    p_organization_id
  );
  
  -- Store credentials
  INSERT INTO integration_credentials (
    integration_id,
    credential_type,
    credentials
  ) VALUES (
    v_integration_id,
    'api_key',
    CASE 
      WHEN p_storefront_access_token IS NOT NULL THEN
        jsonb_build_object(
          'access_token', p_access_token,
          'storefront_access_token', p_storefront_access_token
        )
      ELSE
        jsonb_build_object('access_token', p_access_token)
    END
  );
  
  RETURN v_integration_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback will happen automatically
    RAISE;
END;
$$;