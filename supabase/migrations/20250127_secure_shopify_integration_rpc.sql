-- Update Shopify integration RPC with security validations

-- Drop the existing function first
DROP FUNCTION IF EXISTS create_shopify_integration;

-- Create secure version with validations
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
  v_user_id UUID;
  v_user_org_id UUID;
  v_shopify_domain_pattern TEXT := '^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$';
BEGIN
  -- Get the current user ID from auth context
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No authenticated user';
  END IF;

  -- Verify user belongs to the organization
  SELECT organization_id INTO v_user_org_id
  FROM user_profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_user_org_id IS NULL OR v_user_org_id != p_organization_id THEN
    RAISE EXCEPTION 'Unauthorized: User does not belong to the specified organization';
  END IF;

  -- Validate inputs
  IF p_shop_domain IS NULL OR trim(p_shop_domain) = '' THEN
    RAISE EXCEPTION 'Invalid input: shop_domain cannot be null or empty';
  END IF;

  -- Validate shop domain format
  IF NOT p_shop_domain ~ v_shopify_domain_pattern THEN
    RAISE EXCEPTION 'Invalid input: shop_domain must be a valid Shopify domain (e.g., store-name.myshopify.com)';
  END IF;

  -- Validate sync frequency
  IF p_sync_frequency NOT IN ('realtime', 'hourly', 'daily', 'weekly', 'manual') THEN
    RAISE EXCEPTION 'Invalid input: sync_frequency must be one of: realtime, hourly, daily, weekly, manual';
  END IF;

  -- Validate access token
  IF p_access_token IS NULL OR trim(p_access_token) = '' THEN
    RAISE EXCEPTION 'Invalid input: access_token cannot be null or empty';
  END IF;

  -- Sanitize inputs to prevent injection
  p_shop_domain := lower(trim(p_shop_domain));
  p_access_token := trim(p_access_token);
  
  IF p_storefront_access_token IS NOT NULL THEN
    p_storefront_access_token := trim(p_storefront_access_token);
  END IF;

  -- Check if integration already exists for this shop and organization
  IF EXISTS (
    SELECT 1 
    FROM shopify_config sc
    JOIN integrations i ON i.id = sc.integration_id
    WHERE sc.shop_domain = p_shop_domain
      AND i.organization_id = p_organization_id
      AND i.is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Integration already exists for shop domain % in this organization', p_shop_domain;
  END IF;

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
  
  -- Store credentials (should be encrypted in production)
  -- Note: In production, use pgcrypto or similar for encryption
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

  -- Log the integration creation
  INSERT INTO integration_activity_logs (
    integration_id,
    organization_id,
    log_type,
    severity,
    message,
    details,
    created_at
  ) VALUES (
    v_integration_id,
    p_organization_id,
    'config',
    'info',
    'Shopify integration created',
    jsonb_build_object(
      'shop_domain', p_shop_domain,
      'sync_settings', jsonb_build_object(
        'products', p_sync_products,
        'inventory', p_sync_inventory,
        'orders', p_sync_orders,
        'customers', p_sync_customers
      ),
      'created_by', v_user_id
    ),
    NOW()
  );
  
  RETURN v_integration_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    PERFORM log_error(
      'create_shopify_integration',
      SQLERRM,
      jsonb_build_object(
        'organization_id', p_organization_id,
        'shop_domain', p_shop_domain,
        'user_id', v_user_id
      )
    );
    -- Re-raise the exception
    RAISE;
END;
$$;

-- Update function ownership and permissions
ALTER FUNCTION create_shopify_integration OWNER TO postgres;
REVOKE ALL ON FUNCTION create_shopify_integration FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_shopify_integration TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_shopify_integration IS 'Securely creates a Shopify integration with comprehensive input validation and authorization checks';