-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create function to encrypt credentials using pgp_sym_encrypt for consistency
CREATE OR REPLACE FUNCTION encrypt_credential(p_plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
  v_encrypted TEXT;
BEGIN
  -- Get encryption key from app settings (must be set via environment variables)
  v_key := current_setting('app.encryption_key', true);
  
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Please set app.encryption_key in your environment.';
  END IF;
  
  -- Encrypt using pgp_sym_encrypt for consistency with other migrations
  v_encrypted := encode(
    pgp_sym_encrypt(p_plaintext, v_key, 'compress-algo=1, cipher-algo=aes256'),
    'base64'
  );
  
  RETURN v_encrypted;
END;
$$;

-- Create function to decrypt credentials using pgp_sym_decrypt for consistency
CREATE OR REPLACE FUNCTION decrypt_credential(p_encrypted TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
  v_decrypted TEXT;
BEGIN
  -- Get encryption key from app settings
  v_key := current_setting('app.encryption_key', true);
  
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Please set app.encryption_key in your environment.';
  END IF;
  
  -- Decrypt using pgp_sym_decrypt for consistency with other migrations
  v_decrypted := pgp_sym_decrypt(
    decode(p_encrypted, 'base64'),
    v_key
  );
  
  RETURN v_decrypted;
END;
$$;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION encrypt_credential(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_credential(TEXT) TO authenticated;

-- Create function to update Shopify integration with encryption
CREATE OR REPLACE FUNCTION update_shopify_integration_with_encryption(
  p_shop_domain TEXT,
  p_access_token TEXT,
  p_api_version TEXT DEFAULT '2024-01',
  p_storefront_access_token TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_organization_id UUID;
  v_integration_id UUID;
  v_encrypted_access_token TEXT;
  v_encrypted_storefront_token TEXT;
  v_result JSON;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user's organization
  SELECT organization_id INTO v_organization_id
  FROM user_profiles
  WHERE user_id = v_user_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'User organization not found';
  END IF;

  -- Validate inputs
  IF p_shop_domain IS NULL OR p_shop_domain = '' THEN
    RAISE EXCEPTION 'Shop domain is required';
  END IF;

  IF p_access_token IS NULL OR p_access_token = '' THEN
    RAISE EXCEPTION 'Access token is required';
  END IF;

  -- Sanitize shop domain (remove https://, trailing slashes, etc.)
  p_shop_domain := regexp_replace(
    regexp_replace(
      regexp_replace(p_shop_domain, '^https?://', ''),
      '/$', ''
    ),
    '\.myshopify\.com$', ''
  );
  
  -- Add .myshopify.com if not present
  IF p_shop_domain NOT LIKE '%.myshopify.com' THEN
    p_shop_domain := p_shop_domain || '.myshopify.com';
  END IF;

  -- Sanitize access token
  p_access_token := trim(p_access_token);
  
  -- Encrypt tokens
  v_encrypted_access_token := encrypt_credential(p_access_token);
  
  IF p_storefront_access_token IS NOT NULL THEN
    p_storefront_access_token := trim(p_storefront_access_token);
    v_encrypted_storefront_token := encrypt_credential(p_storefront_access_token);
  END IF;

  -- Check if integration already exists
  IF EXISTS (
    SELECT 1 
    FROM external_integrations 
    WHERE organization_id = v_organization_id 
    AND platform = 'shopify'
    AND shop_domain = p_shop_domain
  ) THEN
    -- Update existing integration
    UPDATE external_integrations
    SET 
      config = jsonb_build_object(
        'api_version', p_api_version,
        'webhook_url', config->>'webhook_url',
        'sync_enabled', COALESCE((config->>'sync_enabled')::boolean, true),
        'sync_interval_minutes', COALESCE((config->>'sync_interval_minutes')::int, 15)
      ),
      api_key = v_encrypted_access_token,
      updated_at = NOW(),
      updated_by = v_user_id
    WHERE organization_id = v_organization_id 
    AND platform = 'shopify'
    AND shop_domain = p_shop_domain
    RETURNING id INTO v_integration_id;

    -- Update or insert storefront token if provided
    IF p_storefront_access_token IS NOT NULL THEN
      INSERT INTO integration_credentials (
        integration_id,
        credential_type,
        encrypted_value,
        created_by,
        updated_by
      ) VALUES (
        v_integration_id,
        'storefront_access_token',
        v_encrypted_storefront_token,
        v_user_id,
        v_user_id
      )
      ON CONFLICT (integration_id, credential_type)
      DO UPDATE SET
        encrypted_value = v_encrypted_storefront_token,
        updated_at = NOW(),
        updated_by = v_user_id;
    END IF;
  ELSE
    -- Insert new integration
    INSERT INTO external_integrations (
      organization_id,
      platform,
      shop_domain,
      api_key,
      config,
      created_by,
      updated_by
    ) VALUES (
      v_organization_id,
      'shopify',
      p_shop_domain,
      v_encrypted_access_token,
      jsonb_build_object(
        'api_version', p_api_version,
        'sync_enabled', true,
        'sync_interval_minutes', 15
      ),
      v_user_id,
      v_user_id
    )
    RETURNING id INTO v_integration_id;

    -- Insert storefront token if provided
    IF p_storefront_access_token IS NOT NULL THEN
      INSERT INTO integration_credentials (
        integration_id,
        credential_type,
        encrypted_value,
        created_by,
        updated_by
      ) VALUES (
        v_integration_id,
        'storefront_access_token',
        v_encrypted_storefront_token,
        v_user_id,
        v_user_id
      );
    END IF;
  END IF;

  -- Prepare result
  v_result := json_build_object(
    'success', true,
    'integration_id', v_integration_id,
    'shop_domain', p_shop_domain,
    'message', CASE 
      WHEN v_integration_id IS NOT NULL THEN 'Shopify integration updated successfully'
      ELSE 'Shopify integration created successfully'
    END
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error details securely
    RAISE EXCEPTION 'Failed to update Shopify integration: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_shopify_integration_with_encryption(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Create helper function to decrypt credentials for authorized access
CREATE OR REPLACE FUNCTION get_shopify_credentials(p_integration_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_organization_id UUID;
  v_integration_org_id UUID;
  v_access_token TEXT;
  v_storefront_token TEXT;
  v_encrypted_access_token TEXT;
  v_encrypted_storefront_token TEXT;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user's organization
  SELECT organization_id INTO v_organization_id
  FROM user_profiles
  WHERE user_id = v_user_id;

  -- Verify the integration belongs to the user's organization
  SELECT organization_id, api_key INTO v_integration_org_id, v_encrypted_access_token
  FROM external_integrations
  WHERE id = p_integration_id
  AND platform = 'shopify';

  IF v_integration_org_id IS NULL THEN
    RAISE EXCEPTION 'Integration not found';
  END IF;

  IF v_integration_org_id != v_organization_id THEN
    RAISE EXCEPTION 'Unauthorized access to integration';
  END IF;

  -- Decrypt access token
  v_access_token := decrypt_credential(v_encrypted_access_token);

  -- Get and decrypt storefront token if exists
  SELECT encrypted_value INTO v_encrypted_storefront_token
  FROM integration_credentials
  WHERE integration_id = p_integration_id
  AND credential_type = 'storefront_access_token';

  IF v_encrypted_storefront_token IS NOT NULL THEN
    v_storefront_token := decrypt_credential(v_encrypted_storefront_token);
  END IF;

  -- Return decrypted credentials
  RETURN json_build_object(
    'access_token', v_access_token,
    'storefront_access_token', v_storefront_token
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_shopify_credentials(UUID) TO authenticated;

-- Add comment for security documentation
COMMENT ON FUNCTION encrypt_credential(TEXT) IS 'Encrypts sensitive credential data using pgp_sym_encrypt with AES-256 cipher';
COMMENT ON FUNCTION decrypt_credential(TEXT) IS 'Decrypts credential data encrypted with encrypt_credential function';
COMMENT ON FUNCTION update_shopify_integration_with_encryption(TEXT, TEXT, TEXT, TEXT) IS 'Updates or creates Shopify integration with encrypted credentials';
COMMENT ON FUNCTION get_shopify_credentials(UUID) IS 'Retrieves decrypted Shopify credentials for authorized users only';