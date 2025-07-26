-- PRP-015: Encrypt Shopify storefront access tokens for security

-- Add a new column for encrypted storage
ALTER TABLE shopify_config
ADD COLUMN IF NOT EXISTS storefront_access_token_encrypted TEXT;

-- Create function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from vault
  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'app_encryption_key'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found in vault';
  END IF;
  
  -- Use pgcrypto to encrypt data
  RETURN encode(
    pgp_sym_encrypt(data, encryption_key),
    'base64'
  );
END;
$$;

-- Create function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from vault
  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'app_encryption_key'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found in vault';
  END IF;
  
  -- Use pgcrypto to decrypt data
  RETURN pgp_sym_decrypt(
    decode(encrypted_data, 'base64'),
    encryption_key
  );
END;
$$;

-- Migrate existing data to encrypted column
UPDATE shopify_config
SET storefront_access_token_encrypted = 
  CASE 
    WHEN storefront_access_token IS NOT NULL 
    THEN encrypt_sensitive_data(storefront_access_token)
    ELSE NULL
  END
WHERE storefront_access_token IS NOT NULL;

-- Create a view that automatically decrypts the token for authorized users
CREATE OR REPLACE VIEW shopify_config_decrypted AS
SELECT 
  id,
  integration_id,
  shop_domain,
  -- Only decrypt if user has permission
  CASE 
    WHEN auth.jwt() ->> 'role' = 'service_role' OR 
         EXISTS (
           SELECT 1 FROM user_profiles 
           WHERE user_id = auth.uid() 
           AND role IN ('admin', 'owner')
         )
    THEN decrypt_sensitive_data(storefront_access_token_encrypted)
    ELSE NULL
  END AS storefront_access_token,
  sync_products,
  sync_inventory,
  sync_orders,
  sync_customers,
  b2b_catalog_enabled,
  default_price_list_id,
  location_mappings,
  created_at,
  updated_at
FROM shopify_config;

-- Create trigger to encrypt on insert/update
CREATE OR REPLACE FUNCTION encrypt_shopify_tokens()
RETURNS TRIGGER AS $$
BEGIN
  -- If storefront_access_token is provided, encrypt it
  IF NEW.storefront_access_token IS NOT NULL THEN
    NEW.storefront_access_token_encrypted = encrypt_sensitive_data(NEW.storefront_access_token);
    NEW.storefront_access_token = NULL; -- Clear the plain text
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS encrypt_shopify_tokens_trigger ON shopify_config;

-- Create the trigger
CREATE TRIGGER encrypt_shopify_tokens_trigger
BEFORE INSERT OR UPDATE ON shopify_config
FOR EACH ROW
EXECUTE FUNCTION encrypt_shopify_tokens();

-- Drop the original unencrypted column after migration
-- This is commented out for safety - run manually after confirming migration success
-- ALTER TABLE shopify_config DROP COLUMN storefront_access_token;

-- Add RLS policies for the decrypted view
ALTER VIEW shopify_config_decrypted SET (security_invoker = on);

-- Grant permissions
GRANT SELECT ON shopify_config_decrypted TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW shopify_config_decrypted IS 'View that provides decrypted storefront access tokens for authorized users only';
COMMENT ON COLUMN shopify_config.storefront_access_token_encrypted IS 'Encrypted storefront access token - use shopify_config_decrypted view to access decrypted value';