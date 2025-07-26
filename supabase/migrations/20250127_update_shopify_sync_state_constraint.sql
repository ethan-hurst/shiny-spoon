-- Update CHECK constraint for shopify_sync_state to include all entity types
-- and use consistent plural naming

-- Drop the existing constraint
ALTER TABLE shopify_sync_state 
DROP CONSTRAINT IF EXISTS shopify_sync_state_entity_type_check;

-- Add the updated constraint with all entity types in plural form
ALTER TABLE shopify_sync_state 
ADD CONSTRAINT shopify_sync_state_entity_type_check 
CHECK (entity_type IN ('products', 'inventory', 'pricing', 'customers', 'orders', 'catalogs'));

-- Update any existing singular entity types to plural
UPDATE shopify_sync_state 
SET entity_type = CASE 
  WHEN entity_type = 'product' THEN 'products'
  WHEN entity_type = 'customer' THEN 'customers'
  WHEN entity_type = 'order' THEN 'orders'
  ELSE entity_type
END
WHERE entity_type IN ('product', 'customer', 'order');