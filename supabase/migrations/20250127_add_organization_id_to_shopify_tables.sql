-- Add organization_id to Shopify tables for proper multi-tenancy

-- Add organization_id to shopify_product_mapping
ALTER TABLE shopify_product_mapping 
ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Update existing rows to get organization_id from their integration
BEGIN;
UPDATE shopify_product_mapping spm
SET organization_id = i.organization_id
FROM integrations i
WHERE spm.integration_id = i.id
AND spm.organization_id IS NULL;
COMMIT;

-- Make organization_id NOT NULL after backfilling
ALTER TABLE shopify_product_mapping 
ALTER COLUMN organization_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_shopify_product_mapping_org 
ON shopify_product_mapping(organization_id);

-- Add organization_id to shopify_b2b_catalogs
ALTER TABLE shopify_b2b_catalogs 
ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Update existing rows
BEGIN;
UPDATE shopify_b2b_catalogs sbc
SET organization_id = i.organization_id
FROM integrations i
WHERE sbc.integration_id = i.id
AND sbc.organization_id IS NULL;
COMMIT;

-- Make organization_id NOT NULL
ALTER TABLE shopify_b2b_catalogs 
ALTER COLUMN organization_id SET NOT NULL;

-- Add index
CREATE INDEX idx_shopify_b2b_catalogs_org 
ON shopify_b2b_catalogs(organization_id);

-- Add metadata column for customer-specific catalogs
ALTER TABLE shopify_b2b_catalogs
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create shopify_catalog_groups table if it doesn't exist
CREATE TABLE IF NOT EXISTS shopify_catalog_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Group info
  shopify_group_id TEXT NOT NULL,
  catalog_id TEXT,
  name TEXT NOT NULL,
  external_id TEXT,
  type TEXT DEFAULT 'company_location',
  parent_id TEXT,
  catalog_ids TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_group UNIQUE(integration_id, shopify_group_id)
);

-- Add index
CREATE INDEX idx_shopify_catalog_groups_org 
ON shopify_catalog_groups(organization_id);

-- Enable RLS
ALTER TABLE shopify_catalog_groups ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for shopify_catalog_groups
CREATE POLICY "Users can view their organization's Shopify catalog groups" ON shopify_catalog_groups
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their organization's Shopify catalog groups" ON shopify_catalog_groups
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_shopify_catalog_groups_updated_at
  BEFORE UPDATE ON shopify_catalog_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add organization_id to shopify_webhook_events (already added in connector.ts but let's ensure schema is correct)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopify_webhook_events' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE shopify_webhook_events 
    ADD COLUMN organization_id UUID REFERENCES organizations(id);
    
    -- Update existing rows
    UPDATE shopify_webhook_events swe
    SET organization_id = i.organization_id
    FROM integrations i
    WHERE swe.integration_id = i.id
    AND swe.organization_id IS NULL;
    
    -- Make NOT NULL
    ALTER TABLE shopify_webhook_events 
    ALTER COLUMN organization_id SET NOT NULL;
    
    -- Add index
    CREATE INDEX idx_shopify_webhook_events_org 
    ON shopify_webhook_events(organization_id);
  END IF;
END $$;