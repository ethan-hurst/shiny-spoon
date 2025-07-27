-- PRP-018: Add encryption to Shopify integration credentials

-- Function to atomically update Shopify integration with encrypted credentials
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
  v_encrypted_token TEXT;
  v_encrypted_secret TEXT;
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

    -- Encrypt new credentials before storing
    IF p_access_token IS NOT NULL THEN
      -- Use the encrypt_credential function from the encryption system
      v_encrypted_token := encrypt_credential(p_access_token, 'integration-key');
      v_existing_credentials = jsonb_set(v_existing_credentials, '{access_token}', to_jsonb(v_encrypted_token));
    END IF;
    
    IF p_webhook_secret IS NOT NULL THEN
      -- Use the encrypt_credential function from the encryption system
      v_encrypted_secret := encrypt_credential(p_webhook_secret, 'integration-key');
      v_existing_credentials = jsonb_set(v_existing_credentials, '{webhook_secret}', to_jsonb(v_encrypted_secret));
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

-- Create function to retrieve decrypted Shopify credentials (for internal use only)
CREATE OR REPLACE FUNCTION get_shopify_credentials(
  p_integration_id UUID,
  p_organization_id UUID
)
RETURNS TABLE (
  access_token TEXT,
  webhook_secret TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credentials JSONB;
  v_encrypted_token TEXT;
  v_encrypted_secret TEXT;
BEGIN
  -- Verify integration belongs to organization
  IF NOT EXISTS (
    SELECT 1 FROM integrations 
    WHERE id = p_integration_id 
    AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Integration not found or access denied';
  END IF;

  -- Get encrypted credentials
  SELECT credentials INTO v_credentials
  FROM integration_credentials
  WHERE integration_id = p_integration_id;

  -- Extract encrypted values
  v_encrypted_token := v_credentials->>'access_token';
  v_encrypted_secret := v_credentials->>'webhook_secret';

  -- Return decrypted values
  RETURN QUERY
  SELECT 
    CASE 
      WHEN v_encrypted_token IS NOT NULL THEN decrypt_credential(v_encrypted_token, 'integration-key')
      ELSE NULL
    END as access_token,
    CASE 
      WHEN v_encrypted_secret IS NOT NULL THEN decrypt_credential(v_encrypted_secret, 'integration-key')
      ELSE NULL
    END as webhook_secret;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_shopify_integration TO authenticated;
GRANT EXECUTE ON FUNCTION get_shopify_credentials TO authenticated;

-- Add comment for security documentation
COMMENT ON FUNCTION update_shopify_integration IS 'Updates Shopify integration configuration with automatic encryption of sensitive credentials';
COMMENT ON FUNCTION get_shopify_credentials IS 'Retrieves decrypted Shopify credentials for authorized integrations only';