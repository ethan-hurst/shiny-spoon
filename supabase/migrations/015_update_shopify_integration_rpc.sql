-- PRP-018: Wrap Shopify integration updates in transaction

-- Function to atomically update Shopify integration with config and credentials
CREATE OR REPLACE FUNCTION update_shopify_integration(
  p_integration_id UUID,
  p_organization_id UUID,
  p_shop_domain TEXT,
  p_sync_frequency INTEGER,
  p_sync_products BOOLEAN,
  p_sync_inventory BOOLEAN,
  p_sync_orders BOOLEAN,
  p_sync_customers BOOLEAN,
  p_b2b_catalog_enabled BOOLEAN,
  p_access_token TEXT DEFAULT NULL,
  p_webhook_secret TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_credentials JSONB;
BEGIN
  -- Verify integration belongs to organization
  IF NOT EXISTS (
    SELECT 1 FROM integrations 
    WHERE id = p_integration_id 
    AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Integration not found or access denied';
  END IF;

  -- Update integration config
  UPDATE integrations
  SET
    config = jsonb_build_object(
      'sync_frequency', p_sync_frequency,
      'api_version', '2024-01'
    ),
    updated_at = NOW()
  WHERE id = p_integration_id
    AND organization_id = p_organization_id;

  -- Update Shopify config
  UPDATE shopify_config
  SET
    shop_domain = p_shop_domain,
    sync_products = p_sync_products,
    sync_inventory = p_sync_inventory,
    sync_orders = p_sync_orders,
    sync_customers = p_sync_customers,
    b2b_catalog_enabled = p_b2b_catalog_enabled,
    updated_at = NOW()
  WHERE integration_id = p_integration_id;

  -- Update credentials if provided
  IF p_access_token IS NOT NULL OR p_webhook_secret IS NOT NULL THEN
    -- Get existing credentials
    SELECT credentials INTO v_existing_credentials
    FROM integration_credentials
    WHERE integration_id = p_integration_id;

    -- Merge with new credentials
    IF p_access_token IS NOT NULL THEN
      v_existing_credentials = jsonb_set(v_existing_credentials, '{access_token}', to_jsonb(p_access_token));
    END IF;
    
    IF p_webhook_secret IS NOT NULL THEN
      v_existing_credentials = jsonb_set(v_existing_credentials, '{webhook_secret}', to_jsonb(p_webhook_secret));
    END IF;

    -- Update credentials
    UPDATE integration_credentials
    SET
      credentials = v_existing_credentials,
      updated_at = NOW()
    WHERE integration_id = p_integration_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_shopify_integration TO authenticated;