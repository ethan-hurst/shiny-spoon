-- PRP-013: NetSuite Integration Schema
--
-- Sync frequency constraints:
-- - Minimum: 1 minute (to prevent excessive API calls)
-- - Maximum: 1440 minutes (24 hours)
-- - Default: 15 minutes
--
-- NetSuite-specific configuration
CREATE TABLE IF NOT EXISTS netsuite_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- NetSuite account info
  account_id TEXT NOT NULL,
  datacenter_url TEXT NOT NULL,
  
  -- Sync configuration
  inventory_sync_enabled BOOLEAN DEFAULT true,
  product_sync_enabled BOOLEAN DEFAULT true,
  pricing_sync_enabled BOOLEAN DEFAULT true,
  
  -- Field mappings
  field_mappings JSONB DEFAULT '{}',
  
  -- Sync settings
  sync_frequency INTEGER DEFAULT 15 CONSTRAINT valid_sync_frequency CHECK (sync_frequency > 0 AND sync_frequency <= 1440), -- Minutes (min: 1, max: 1440 = 24 hours)
  last_full_sync TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(integration_id)
);

-- NetSuite sync state tracking
CREATE TABLE IF NOT EXISTS netsuite_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Entity tracking
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'inventory', 'pricing')),
  last_sync_date TIMESTAMPTZ,
  last_sync_token TEXT,
  sync_cursor JSONB,
  
  -- Stats
  total_synced INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(integration_id, entity_type)
);

-- NetSuite webhook events
CREATE TABLE IF NOT EXISTS netsuite_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Event details
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  
  -- Processing
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Payload
  payload JSONB NOT NULL,
  error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Prevent duplicate events
  CONSTRAINT unique_netsuite_event UNIQUE(event_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_netsuite_webhook_status 
  ON netsuite_webhook_events(status, created_at) 
  WHERE status IN ('pending', 'processing');
  
CREATE INDEX IF NOT EXISTS idx_netsuite_webhook_integration 
  ON netsuite_webhook_events(integration_id, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_netsuite_sync_state 
  ON netsuite_sync_state(integration_id, entity_type);

-- RLS Policies
ALTER TABLE netsuite_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE netsuite_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE netsuite_webhook_events ENABLE ROW LEVEL SECURITY;

-- NetSuite config policies
CREATE POLICY "Users can view own organization netsuite config" ON netsuite_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.id = netsuite_config.integration_id
      AND i.organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own organization netsuite config" ON netsuite_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.id = netsuite_config.integration_id
      AND i.organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own organization netsuite config" ON netsuite_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.id = netsuite_config.integration_id
      AND i.organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Sync state policies (read-only for users)
CREATE POLICY "Users can view own organization sync state" ON netsuite_sync_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.id = netsuite_sync_state.integration_id
      AND i.organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Webhook events policies (read-only for users)
CREATE POLICY "Users can view own organization webhook events" ON netsuite_webhook_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.id = netsuite_webhook_events.integration_id
      AND i.organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Function to process NetSuite webhook events
CREATE OR REPLACE FUNCTION process_netsuite_webhook_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a sync job for the webhook event
  IF NEW.status = 'pending' THEN
    PERFORM create_sync_job(
      p_integration_id => NEW.integration_id,
      p_organization_id => (
        SELECT organization_id FROM integrations 
        WHERE id = NEW.integration_id
      ),
      p_job_type => 'webhook',
      p_payload => jsonb_build_object(
        'webhook_event_id', NEW.id,
        'event_type', NEW.event_type,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'payload', NEW.payload
      ),
      p_priority => 3 -- High priority for webhooks
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process webhook events
CREATE TRIGGER process_netsuite_webhook_trigger
  AFTER INSERT ON netsuite_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION process_netsuite_webhook_event();

-- Updated_at triggers
CREATE TRIGGER update_netsuite_config_updated_at
  BEFORE UPDATE ON netsuite_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_netsuite_sync_state_updated_at
  BEFORE UPDATE ON netsuite_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();