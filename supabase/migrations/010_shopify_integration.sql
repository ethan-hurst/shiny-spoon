-- PRP-014: Shopify B2B Integration Database Schema

-- Shopify-specific configuration
CREATE TABLE IF NOT EXISTS shopify_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,

  -- Store information
  shop_domain TEXT NOT NULL, -- mystore.myshopify.com
  storefront_access_token TEXT, -- For customer portal
  
  -- Sync configuration
  sync_products BOOLEAN DEFAULT true,
  sync_inventory BOOLEAN DEFAULT true,
  sync_orders BOOLEAN DEFAULT true,
  sync_customers BOOLEAN DEFAULT true,
  
  -- Catalog settings
  b2b_catalog_enabled BOOLEAN DEFAULT false,
  default_price_list_id TEXT, -- Shopify price list ID
  
  -- Location mapping
  location_mappings JSONB DEFAULT '{}', -- Shopify location -> warehouse
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_integration FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
  CONSTRAINT unique_integration UNIQUE (integration_id)
);

-- Shopify sync tracking
CREATE TABLE IF NOT EXISTS shopify_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Sync tracking
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'inventory', 'order', 'customer')),
  last_sync_at TIMESTAMPTZ,
  bulk_operation_id TEXT, -- Shopify bulk operation ID
  sync_cursor TEXT, -- For pagination
  
  -- Statistics
  total_synced INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  last_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_integration_entity UNIQUE(integration_id, entity_type)
);

-- Shopify product mapping
CREATE TABLE IF NOT EXISTS shopify_product_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Mapping
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT NOT NULL,
  internal_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- Sync metadata
  last_synced_at TIMESTAMPTZ,
  shopify_updated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_integration_variant UNIQUE(integration_id, shopify_variant_id)
);

-- Shopify webhook events
CREATE TABLE IF NOT EXISTS shopify_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Event details
  event_id TEXT NOT NULL UNIQUE, -- X-Shopify-Webhook-Id
  topic TEXT NOT NULL, -- products/update, inventory_levels/update
  shop_domain TEXT NOT NULL,
  api_version TEXT NOT NULL,
  
  -- Processing
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  
  -- Payload
  payload JSONB NOT NULL,
  error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- B2B catalog configuration
CREATE TABLE IF NOT EXISTS shopify_b2b_catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Catalog info
  shopify_catalog_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  
  -- Pricing rules
  price_list_id TEXT,
  discount_percentage DECIMAL(5,2),
  
  -- Customer mapping
  customer_tier_id UUID REFERENCES customer_tiers(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_catalog UNIQUE(integration_id, shopify_catalog_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shopify_webhook_status 
  ON shopify_webhook_events(status, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_shopify_product_mapping 
  ON shopify_product_mapping(integration_id, internal_product_id);

CREATE INDEX IF NOT EXISTS idx_shopify_sync_state 
  ON shopify_sync_state(integration_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_shopify_webhook_events_integration 
  ON shopify_webhook_events(integration_id);

CREATE INDEX IF NOT EXISTS idx_shopify_b2b_catalogs_tier 
  ON shopify_b2b_catalogs(customer_tier_id);

-- RLS Policies

-- Enable RLS on all tables
ALTER TABLE shopify_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_product_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_b2b_catalogs ENABLE ROW LEVEL SECURITY;

-- shopify_config policies
CREATE POLICY "Users can view their organization's Shopify config" ON shopify_config
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their organization's Shopify config" ON shopify_config
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- shopify_sync_state policies  
CREATE POLICY "Users can view their organization's Shopify sync state" ON shopify_sync_state
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their organization's Shopify sync state" ON shopify_sync_state
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- shopify_product_mapping policies
CREATE POLICY "Users can view their organization's Shopify product mappings" ON shopify_product_mapping
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their organization's Shopify product mappings" ON shopify_product_mapping
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- shopify_webhook_events policies
CREATE POLICY "Users can view their organization's Shopify webhook events" ON shopify_webhook_events
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role can manage webhook events" ON shopify_webhook_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- shopify_b2b_catalogs policies
CREATE POLICY "Users can view their organization's Shopify B2B catalogs" ON shopify_b2b_catalogs
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their organization's Shopify B2B catalogs" ON shopify_b2b_catalogs
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_shopify_config_updated_at
  BEFORE UPDATE ON shopify_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopify_sync_state_updated_at
  BEFORE UPDATE ON shopify_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopify_product_mapping_updated_at
  BEFORE UPDATE ON shopify_product_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopify_b2b_catalogs_updated_at
  BEFORE UPDATE ON shopify_b2b_catalogs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log Shopify sync activity
CREATE OR REPLACE FUNCTION log_shopify_sync_activity(
  p_integration_id UUID,
  p_entity_type TEXT,
  p_action TEXT,
  p_details JSONB
) RETURNS void AS $$
BEGIN
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
    format('Shopify %s %s', p_entity_type, p_action),
    p_details,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_shopify_sync_activity TO authenticated;