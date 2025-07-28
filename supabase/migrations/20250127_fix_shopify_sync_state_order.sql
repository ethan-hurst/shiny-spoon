-- PRP-017A: Fix migration order for Shopify sync state constraint
-- This migration must run after 010_shopify_integration.sql

-- First, update any existing data to use plural forms
-- This ensures no data violates the new constraint
UPDATE shopify_sync_state 
SET entity_type = CASE 
  WHEN entity_type = 'product' THEN 'products'
  WHEN entity_type = 'customer' THEN 'customers'
  WHEN entity_type = 'order' THEN 'orders'
  WHEN entity_type = 'inventory' THEN 'inventory' -- already correct
  ELSE entity_type
END
WHERE entity_type IN ('product', 'customer', 'order');

-- Now drop the existing constraint
ALTER TABLE shopify_sync_state 
DROP CONSTRAINT IF EXISTS shopify_sync_state_entity_type_check;

-- Add the updated constraint with all entity types in plural form
-- Including new entity types: pricing and catalogs
ALTER TABLE shopify_sync_state 
ADD CONSTRAINT shopify_sync_state_entity_type_check 
CHECK (entity_type IN ('products', 'inventory', 'pricing', 'customers', 'orders', 'catalogs'));

-- Also update the log_shopify_sync_activity function to accept plural forms
CREATE OR REPLACE FUNCTION log_shopify_sync_activity(
  p_integration_id UUID,
  p_entity_type TEXT,
  p_action TEXT,
  p_details JSONB
) RETURNS void AS $$
BEGIN
  -- Validate inputs
  IF p_integration_id IS NULL THEN
    RAISE EXCEPTION 'integration_id cannot be null';
  END IF;
  
  IF p_entity_type IS NULL OR p_entity_type = '' THEN
    RAISE EXCEPTION 'entity_type cannot be null or empty';
  END IF;
  
  -- Validate entity_type is one of allowed values (both singular and plural for compatibility)
  IF p_entity_type NOT IN (
    'product', 'products', 
    'inventory', 
    'order', 'orders', 
    'customer', 'customers', 
    'pricing', 
    'catalogs',
    'bulk_operation', 
    'webhook', 
    'b2b_catalog'
  ) THEN
    RAISE EXCEPTION 'Invalid entity_type: %. Must be one of: products, inventory, orders, customers, pricing, catalogs, bulk_operation, webhook, b2b_catalog', p_entity_type;
  END IF;
  
  IF p_action IS NULL OR p_action = '' THEN
    RAISE EXCEPTION 'action cannot be null or empty';
  END IF;
  
  -- Normalize entity type to plural form for consistency in logs
  DECLARE
    v_normalized_entity_type TEXT;
  BEGIN
    v_normalized_entity_type := CASE
      WHEN p_entity_type = 'product' THEN 'products'
      WHEN p_entity_type = 'order' THEN 'orders'
      WHEN p_entity_type = 'customer' THEN 'customers'
      ELSE p_entity_type
    END;
    
    -- Prepare sanitized details (encrypt sensitive data)
    DECLARE
      v_sanitized_details JSONB;
    BEGIN
      v_sanitized_details := p_details;
      
      -- Remove or encrypt sensitive fields if present
      IF v_sanitized_details ? 'credentials' THEN
        v_sanitized_details := v_sanitized_details - 'credentials';
        v_sanitized_details := v_sanitized_details || jsonb_build_object(
          'credentials_encrypted', pgp_sym_encrypt(
            (p_details->>'credentials')::text,
            current_setting('app.encryption_key', true),
            'compress-algo=1, cipher-algo=aes256'
          )
        );
      END IF;
      
      -- Remove other sensitive fields
      IF v_sanitized_details ? 'api_key' THEN
        v_sanitized_details := v_sanitized_details - 'api_key' || 
          jsonb_build_object('api_key', '[REDACTED]');
      END IF;
      
      IF v_sanitized_details ? 'access_token' THEN
        v_sanitized_details := v_sanitized_details - 'access_token' || 
          jsonb_build_object('access_token', '[REDACTED]');
      END IF;
      
      -- Insert log entry with sanitized details
      INSERT INTO integration_logs (
        integration_id,
        log_type,
        severity,
        message,
        details,
        created_at
      ) VALUES (
        p_integration_id,
        'sync',
        'info',
        format('Shopify %s %s', v_normalized_entity_type, p_action),
        v_sanitized_details,
        NOW()
      );
    END;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_shopify_sync_activity TO authenticated;

-- Add comment documenting the migration order dependency
COMMENT ON TABLE shopify_sync_state IS 
'Tracks sync state for Shopify entities. Uses plural entity types (products, customers, orders, etc).
Migration 20250127_fix_shopify_sync_state_order.sql must run after 010_shopify_integration.sql';