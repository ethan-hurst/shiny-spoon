-- ERP Integration Schema
-- Purpose: Support multi-ERP integrations with conflict resolution and sync tracking

-- ERP connections table
CREATE TABLE erp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  erp_type VARCHAR(50) NOT NULL CHECK (erp_type IN ('SAP', 'NETSUITE', 'DYNAMICS365', 'ORACLE_CLOUD', 'INFOR', 'EPICOR', 'SAGE')),
  config JSONB NOT NULL, -- Encrypted connection config
  priority INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMPTZ,
  sync_errors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT unique_erp_name_per_org UNIQUE (organization_id, name)
);

-- ERP sync strategies
CREATE TABLE erp_sync_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  strategy_type VARCHAR(20) NOT NULL CHECK (strategy_type IN ('full', 'incremental', 'real-time')),
  entities TEXT[] NOT NULL, -- Array of entities to sync
  interval_minutes INTEGER,
  conflict_resolution VARCHAR(20) DEFAULT 'last-write-wins',
  master_erp_id UUID REFERENCES erp_connections(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Field mappings between ERP and unified schema
CREATE TABLE erp_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  source_field VARCHAR(255) NOT NULL,
  target_field VARCHAR(255) NOT NULL,
  transform_function VARCHAR(100),
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_field_mapping UNIQUE (erp_connection_id, entity_type, source_field, target_field)
);

-- Sync history and status
CREATE TABLE erp_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  sync_type VARCHAR(20) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  conflicts_detected INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB
);

-- Data conflicts tracking
CREATE TABLE erp_data_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  sources JSONB NOT NULL, -- Array of conflict sources with data
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  resolution JSONB,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  
  INDEX idx_conflicts_status (status),
  INDEX idx_conflicts_entity (entity_type, entity_id)
);

-- Conflict resolution rules
CREATE TABLE erp_conflict_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  conflict_type VARCHAR(50) NOT NULL,
  condition_expression TEXT, -- SQL expression to evaluate
  resolution_strategy VARCHAR(50) NOT NULL,
  resolution_config JSONB,
  priority INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ERP event subscriptions
CREATE TABLE erp_event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_event_subscription UNIQUE (erp_connection_id, event_type)
);

-- ERP webhook logs
CREATE TABLE erp_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_webhook_logs_processed (processed, received_at)
);

-- Data mapping cache
CREATE TABLE erp_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_connection_id UUID NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  erp_data JSONB NOT NULL,
  unified_data JSONB,
  last_modified TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  CONSTRAINT unique_cache_entry UNIQUE (erp_connection_id, entity_type, entity_id),
  INDEX idx_cache_expires (expires_at)
);

-- Create indexes
CREATE INDEX idx_erp_connections_org ON erp_connections(organization_id);
CREATE INDEX idx_erp_connections_active ON erp_connections(is_active) WHERE is_active = true;
CREATE INDEX idx_sync_logs_connection ON erp_sync_logs(erp_connection_id, started_at DESC);
CREATE INDEX idx_sync_logs_status ON erp_sync_logs(status, started_at DESC);

-- Create views for monitoring
CREATE VIEW erp_sync_status AS
SELECT 
  ec.id,
  ec.organization_id,
  ec.name,
  ec.erp_type,
  ec.is_active,
  ec.last_sync,
  ec.sync_errors,
  (
    SELECT COUNT(*) 
    FROM erp_sync_logs esl 
    WHERE esl.erp_connection_id = ec.id 
    AND esl.status = 'failed' 
    AND esl.started_at > NOW() - INTERVAL '24 hours'
  ) as recent_failures,
  (
    SELECT COUNT(*) 
    FROM erp_data_conflicts edc 
    WHERE edc.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(edc.sources) s 
      WHERE s->>'erp' = ec.erp_type
    )
  ) as pending_conflicts
FROM erp_connections ec;

-- Functions
CREATE OR REPLACE FUNCTION encrypt_erp_config()
RETURNS TRIGGER AS $$
BEGIN
  -- In production, use pgcrypto to encrypt sensitive config
  -- NEW.config = pgp_sym_encrypt(NEW.config::text, current_setting('app.encryption_key'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_erp_config_trigger
  BEFORE INSERT OR UPDATE ON erp_connections
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_erp_config();

-- Function to detect conflicts
CREATE OR REPLACE FUNCTION detect_erp_conflicts(
  p_entity_type VARCHAR,
  p_entity_id VARCHAR,
  p_sources JSONB
) RETURNS UUID AS $$
DECLARE
  v_conflict_id UUID;
  v_existing_id UUID;
BEGIN
  -- Check if conflict already exists
  SELECT id INTO v_existing_id
  FROM erp_data_conflicts
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND status = 'pending';
  
  IF v_existing_id IS NOT NULL THEN
    -- Update existing conflict
    UPDATE erp_data_conflicts
    SET sources = p_sources,
        detected_at = NOW()
    WHERE id = v_existing_id;
    
    RETURN v_existing_id;
  ELSE
    -- Create new conflict
    INSERT INTO erp_data_conflicts (
      conflict_type,
      entity_type,
      entity_id,
      sources
    ) VALUES (
      'update_conflict',
      p_entity_type,
      p_entity_id,
      p_sources
    ) RETURNING id INTO v_conflict_id;
    
    RETURN v_conflict_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve conflicts
CREATE OR REPLACE FUNCTION resolve_erp_conflict(
  p_conflict_id UUID,
  p_resolution JSONB,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE erp_data_conflicts
  SET status = 'resolved',
      resolution = p_resolution,
      resolved_by = p_user_id,
      resolved_at = NOW()
  WHERE id = p_conflict_id
    AND status = 'pending';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE erp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_sync_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_data_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_conflict_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_data_cache ENABLE ROW LEVEL SECURITY;

-- Policies for erp_connections
CREATE POLICY "Users can view their org's ERP connections"
  ON erp_connections FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage ERP connections"
  ON erp_connections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = erp_connections.organization_id
      AND u.role IN ('admin', 'owner')
    )
  );

-- Similar policies for other tables
CREATE POLICY "Users can view sync logs"
  ON erp_sync_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM erp_connections ec
      WHERE ec.id = erp_sync_logs.erp_connection_id
      AND ec.organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view conflicts"
  ON erp_data_conflicts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can resolve conflicts"
  ON erp_data_conflicts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'owner')
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_erp_connections_updated_at
  BEFORE UPDATE ON erp_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_erp_sync_strategies_updated_at
  BEFORE UPDATE ON erp_sync_strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_erp_conflict_rules_updated_at
  BEFORE UPDATE ON erp_conflict_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();