-- PRP-018: Wrap Shopify sync settings updates in transaction

-- Function to atomically update Shopify sync settings
CREATE OR REPLACE FUNCTION update_shopify_sync_settings(
  p_integration_id UUID,
  p_organization_id UUID,
  p_sync_products BOOLEAN,
  p_sync_inventory BOOLEAN,
  p_sync_orders BOOLEAN,
  p_sync_customers BOOLEAN,
  p_b2b_catalog_enabled BOOLEAN,
  p_sync_frequency INTEGER,
  p_batch_size INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
      'batch_size', p_batch_size,
      'api_version', '2024-01'
    ),
    updated_at = NOW()
  WHERE id = p_integration_id
    AND organization_id = p_organization_id;

  -- Update Shopify config
  UPDATE shopify_config
  SET
    sync_products = p_sync_products,
    sync_inventory = p_sync_inventory,
    sync_orders = p_sync_orders,
    sync_customers = p_sync_customers,
    b2b_catalog_enabled = p_b2b_catalog_enabled,
    updated_at = NOW()
  WHERE integration_id = p_integration_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_shopify_sync_settings TO authenticated;