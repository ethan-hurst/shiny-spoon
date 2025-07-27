-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create function to encrypt credentials
CREATE OR REPLACE FUNCTION encrypt_credential(p_plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
  v_encrypted TEXT;
  v_iv BYTEA;
  v_key_hash BYTEA;
BEGIN
  -- Get encryption key from app settings (must be set via environment variables)
  v_key := current_setting('app.encryption_key', true);
  
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Please set app.encryption_key in your environment.';
  END IF;
  
  -- Generate a random 16-byte IV for AES-CBC
  v_iv := gen_random_bytes(16);
  
  -- Create a 256-bit key from the provided key using SHA-256
  v_key_hash := digest(v_key::bytea, 'sha256');
  
  -- Encrypt using AES-256-CBC with IV
  v_encrypted := encode(
    v_iv || encrypt_iv(
      p_plaintext::bytea,
      v_key_hash,
      v_iv,
      'aes-cbc/pad:pkcs'
    ),
    'base64'
  );
  
  RETURN v_encrypted;
END;
$$;

-- Create function to decrypt credentials
CREATE OR REPLACE FUNCTION decrypt_credential(p_encrypted TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
  v_decrypted TEXT;
  v_data BYTEA;
  v_iv BYTEA;
  v_ciphertext BYTEA;
  v_key_hash BYTEA;
BEGIN
  -- Get encryption key from app settings (must be set via environment variables)
  v_key := current_setting('app.encryption_key', true);
  
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Please set app.encryption_key in your environment.';
  END IF;
  
  -- Decode the base64 data
  v_data := decode(p_encrypted, 'base64');
  
  -- Extract IV (first 16 bytes) and ciphertext (remaining bytes)
  v_iv := substring(v_data from 1 for 16);
  v_ciphertext := substring(v_data from 17);
  
  -- Create a 256-bit key from the provided key using SHA-256
  v_key_hash := digest(v_key::bytea, 'sha256');
  
  -- Decrypt using AES-256-CBC with IV
  BEGIN
    v_decrypted := convert_from(
      decrypt_iv(
        v_ciphertext,
        v_key_hash,
        v_iv,
        'aes-cbc/pad:pkcs'
      ),
      'utf8'
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log decryption failure without exposing details
      RAISE EXCEPTION 'Failed to decrypt credentials. Please check encryption key configuration.';
  END;
  
  RETURN v_decrypted;
END;
$$;

-- Update the create_shopify_integration function to use encryption
CREATE OR REPLACE FUNCTION create_shopify_integration_encrypted(
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
  v_encrypted_access_token TEXT;
  v_encrypted_storefront_token TEXT;
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

  -- Sanitize shop domain first
  p_shop_domain := lower(trim(p_shop_domain));

  -- Validate shop domain format after sanitization
  IF NOT p_shop_domain ~ v_shopify_domain_pattern THEN
    RAISE EXCEPTION 'Invalid input: shop_domain must be a valid Shopify domain';
  END IF;

  -- Validate sync frequency
  IF p_sync_frequency NOT IN ('realtime', 'hourly', 'daily', 'weekly', 'manual') THEN
    RAISE EXCEPTION 'Invalid input: Invalid sync_frequency';
  END IF;

  -- Validate access token
  IF p_access_token IS NULL OR trim(p_access_token) = '' THEN
    RAISE EXCEPTION 'Invalid input: access_token cannot be null or empty';
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
    FROM shopify_config sc
    JOIN integrations i ON i.id = sc.integration_id
    WHERE sc.shop_domain = p_shop_domain
      AND i.organization_id = p_organization_id
      AND i.is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Integration already exists for this shop';
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
  
  -- Store encrypted credentials
  INSERT INTO integration_credentials (
    integration_id,
    credential_type,
    credentials,
    encrypted
  ) VALUES (
    v_integration_id,
    'api_key',
    CASE 
      WHEN v_encrypted_storefront_token IS NOT NULL THEN
        jsonb_build_object(
          'access_token', v_encrypted_access_token,
          'storefront_access_token', v_encrypted_storefront_token
        )
      ELSE
        jsonb_build_object('access_token', v_encrypted_access_token)
    END,
    true
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
    'Shopify integration created with encrypted credentials',
    jsonb_build_object(
      'shop_domain', p_shop_domain,
      'created_by', v_user_id
    ),
    NOW()
  );
  
  RETURN v_integration_id;
END;
$$;

-- Create function to get decrypted credentials (restricted access)
CREATE OR REPLACE FUNCTION get_shopify_credentials(p_integration_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_org_id UUID;
  v_integration_org_id UUID;
  v_encrypted_creds JSONB;
  v_decrypted_creds JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No authenticated user';
  END IF;

  -- Get user's organization
  SELECT organization_id INTO v_user_org_id
  FROM user_profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Get integration's organization
  SELECT organization_id INTO v_integration_org_id
  FROM integrations
  WHERE id = p_integration_id;

  -- Verify user has access
  IF v_user_org_id IS NULL OR v_user_org_id != v_integration_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to integration credentials';
  END IF;

  -- Get encrypted credentials
  SELECT credentials INTO v_encrypted_creds
  FROM integration_credentials
  WHERE integration_id = p_integration_id
    AND credential_type = 'api_key'
  LIMIT 1;

  IF v_encrypted_creds IS NULL THEN
    RETURN NULL;
  END IF;

  -- Decrypt credentials
  v_decrypted_creds := jsonb_build_object();
  
  IF v_encrypted_creds ? 'access_token' THEN
    v_decrypted_creds := v_decrypted_creds || 
      jsonb_build_object('access_token', decrypt_credential(v_encrypted_creds->>'access_token'));
  END IF;
  
  IF v_encrypted_creds ? 'storefront_access_token' THEN
    v_decrypted_creds := v_decrypted_creds || 
      jsonb_build_object('storefront_access_token', decrypt_credential(v_encrypted_creds->>'storefront_access_token'));
  END IF;

  -- Log access
  INSERT INTO integration_activity_logs (
    integration_id,
    organization_id,
    log_type,
    severity,
    message,
    details,
    created_at
  ) VALUES (
    p_integration_id,
    v_integration_org_id,
    'security',
    'info',
    'Credentials accessed',
    jsonb_build_object(
      'accessed_by', v_user_id,
      'timestamp', NOW()
    ),
    NOW()
  );

  RETURN v_decrypted_creds;
END;
$$;

-- Add encrypted column to integration_credentials if it doesn't exist
ALTER TABLE integration_credentials 
ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT false;

-- Restrict access to encryption functions
REVOKE ALL ON FUNCTION encrypt_credential FROM PUBLIC;
REVOKE ALL ON FUNCTION decrypt_credential FROM PUBLIC;
REVOKE ALL ON FUNCTION get_shopify_credentials FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shopify_credentials TO authenticated;

-- Create policy for integration_credentials table
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access credentials for their org integrations"
  ON integration_credentials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM integrations i
      JOIN user_profiles up ON up.organization_id = i.organization_id
      WHERE i.id = integration_credentials.integration_id
        AND up.user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON FUNCTION encrypt_credential IS 'Encrypts sensitive credential data using AES encryption';
COMMENT ON FUNCTION decrypt_credential IS 'Decrypts sensitive credential data - restricted access';
COMMENT ON FUNCTION get_shopify_credentials IS 'Retrieves and decrypts Shopify credentials with authorization checks';
COMMENT ON COLUMN integration_credentials.encrypted IS 'Indicates whether the credentials are encrypted';