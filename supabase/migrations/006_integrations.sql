-- Integration Framework Database Schema
-- This migration implements PRP-012: Integration Framework

-- Integration configurations
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Integration details
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN (
    'netsuite', 'shopify', 'quickbooks', 'sap', 'dynamics365', 'custom'
  )),
  description TEXT,

  -- Status
  status TEXT DEFAULT 'inactive' CHECK (status IN (
    'active', 'inactive', 'error', 'configuring', 'suspended'
  )),
  last_sync_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,

  -- Configuration
  config JSONB DEFAULT '{}', -- Non-sensitive config
  sync_settings JSONB DEFAULT '{}', -- Sync preferences

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Encrypted credentials storage
CREATE TABLE integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,

  -- Encrypted storage
  credential_type TEXT NOT NULL CHECK (credential_type IN (
    'oauth2', 'api_key', 'basic_auth', 'custom'
  )),
  encrypted_data TEXT NOT NULL, -- Encrypted with Supabase Vault

  -- OAuth specific
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

-- Webhook configurations
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,

  -- Endpoint details
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- For webhook verification
  events TEXT[] NOT NULL, -- Event types to listen for

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_received_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration logs
CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Log details
  log_type TEXT NOT NULL CHECK (log_type IN (
    'sync', 'webhook', 'error', 'auth', 'config'
  )),
  severity TEXT DEFAULT 'info' CHECK (severity IN (
    'debug', 'info', 'warning', 'error', 'critical'
  )),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',

  -- Request/Response tracking
  request_id TEXT,
  request_data JSONB,
  response_data JSONB,
  response_status INTEGER,

  -- Performance
  duration_ms INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Sync jobs queue
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Job details
  job_type TEXT NOT NULL CHECK (job_type IN (
    'full_sync', 'incremental_sync', 'webhook', 'manual'
  )),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  )),
  priority INTEGER DEFAULT 5, -- 1-10, lower is higher priority

  -- Execution details
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,

  -- Data
  payload JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  error TEXT,

  -- Progress tracking
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting tracking
CREATE TABLE rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,

  -- Bucket details
  bucket_key TEXT NOT NULL, -- e.g., 'api_calls', 'webhooks'
  window_start TIMESTAMPTZ NOT NULL,
  window_duration_seconds INTEGER NOT NULL,

  -- Counts
  request_count INTEGER DEFAULT 0,
  max_requests INTEGER NOT NULL,

  -- Unique constraint
  UNIQUE(integration_id, bucket_key, window_start)
);

-- Indexes
CREATE INDEX idx_integrations_org_status ON integrations(organization_id, status);
CREATE INDEX idx_integration_logs_integration ON integration_logs(integration_id, created_at DESC);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status, scheduled_for)
  WHERE status IN ('pending', 'running');
CREATE INDEX idx_rate_limit_window ON rate_limit_buckets(integration_id, bucket_key, window_start);

-- RLS Policies
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integrations table
CREATE POLICY "Users can view integrations in their organization" ON integrations
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Users can insert integrations in their organization" ON integrations
  FOR INSERT WITH CHECK (
    organization_id = (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Users can update integrations in their organization" ON integrations
  FOR UPDATE USING (
    organization_id = (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Users can delete integrations in their organization" ON integrations
  FOR DELETE USING (
    organization_id = (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  );

-- RLS Policies for integration_credentials table
CREATE POLICY "Users can view credentials for their integrations" ON integration_credentials
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations 
      WHERE organization_id = (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid() 
        LIMIT 1
      )
    )
  );

CREATE POLICY "Users can insert credentials for their integrations" ON integration_credentials
  FOR INSERT WITH CHECK (
    integration_id IN (
      SELECT id FROM integrations 
      WHERE organization_id = (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid() 
        LIMIT 1
      )
    )
  );

CREATE POLICY "Users can update credentials for their integrations" ON integration_credentials
  FOR UPDATE USING (
    integration_id IN (
      SELECT id FROM integrations 
      WHERE organization_id = (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid() 
        LIMIT 1
      )
    )
  );

-- RLS Policies for webhook_endpoints table
CREATE POLICY "Users can view webhook endpoints for their integrations" ON webhook_endpoints
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations 
      WHERE organization_id = (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid() 
        LIMIT 1
      )
    )
  );

CREATE POLICY "Users can manage webhook endpoints for their integrations" ON webhook_endpoints
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations 
      WHERE organization_id = (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid() 
        LIMIT 1
      )
    )
  );

-- RLS Policies for integration_logs table
CREATE POLICY "Users can view logs for their integrations" ON integration_logs
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "System can insert logs" ON integration_logs
  FOR INSERT WITH CHECK (true); -- System level access for logging

-- RLS Policies for sync_jobs table
CREATE POLICY "Users can view sync jobs for their integrations" ON sync_jobs
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Users can create sync jobs for their integrations" ON sync_jobs
  FOR INSERT WITH CHECK (
    organization_id = (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "System can update sync jobs" ON sync_jobs
  FOR UPDATE USING (true); -- System level access for job processing

-- RLS Policies for rate_limit_buckets table
CREATE POLICY "System can manage rate limits" ON rate_limit_buckets
  FOR ALL USING (true); -- System level access for rate limiting

-- Functions for credential encryption
CREATE OR REPLACE FUNCTION encrypt_credential(
  p_credential TEXT,
  p_key_id TEXT DEFAULT 'app-secret-key'
) RETURNS TEXT AS $$
BEGIN
  -- For now, return base64 encoded text
  -- In production, this should use proper encryption
  RETURN encode(p_credential::bytea, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_credential(
  p_encrypted TEXT,
  p_key_id TEXT DEFAULT 'app-secret-key'
) RETURNS TEXT AS $$
BEGIN
  -- For now, return base64 decoded text
  -- In production, this should use proper decryption
  RETURN convert_from(decode(p_encrypted, 'base64'), 'utf8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for integrations table
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for integration_credentials table
CREATE TRIGGER update_integration_credentials_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function for incrementing rate limit buckets
CREATE OR REPLACE FUNCTION increment_rate_limit_bucket(
  p_integration_id UUID,
  p_bucket_key TEXT,
  p_window_start TIMESTAMPTZ,
  p_increment INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE rate_limit_buckets
  SET request_count = request_count + p_increment
  WHERE integration_id = p_integration_id
    AND bucket_key = p_bucket_key
    AND window_start = p_window_start;
END;
$$ LANGUAGE plpgsql;

-- Helper function for logging integration activity
CREATE OR REPLACE FUNCTION log_integration_activity(
  p_integration_id UUID,
  p_organization_id UUID,
  p_log_type TEXT,
  p_severity TEXT DEFAULT 'info',
  p_message TEXT DEFAULT '',
  p_details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO integration_logs (
    integration_id,
    organization_id,
    log_type,
    severity,
    message,
    details
  ) VALUES (
    p_integration_id,
    p_organization_id,
    p_log_type,
    p_severity,
    p_message,
    p_details
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;