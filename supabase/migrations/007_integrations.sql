-- PRP-012: Integration Framework Database Schema
-- This migration creates all tables and functions needed for the integration framework

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Integration configurations table
CREATE TABLE IF NOT EXISTS integrations (
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
CREATE TABLE IF NOT EXISTS integration_credentials (
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
CREATE TABLE IF NOT EXISTS webhook_endpoints (
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
CREATE TABLE IF NOT EXISTS integration_logs (
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
CREATE TABLE IF NOT EXISTS sync_jobs (
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
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
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

-- Create indexes for performance
CREATE INDEX idx_integrations_org_status ON integrations(organization_id, status);
CREATE INDEX idx_integration_credentials_integration ON integration_credentials(integration_id);
CREATE INDEX idx_integration_logs_integration ON integration_logs(integration_id, created_at DESC);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status, scheduled_for)
  WHERE status IN ('pending', 'running');
CREATE INDEX idx_rate_limit_window ON rate_limit_buckets(integration_id, bucket_key, window_start);

-- Enable Row Level Security
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integrations table
CREATE POLICY "Users can view own organization integrations" ON integrations
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create integrations for own organization" ON integrations
  FOR INSERT WITH CHECK (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own organization integrations" ON integrations
  FOR UPDATE USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own organization integrations" ON integrations
  FOR DELETE USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for integration_credentials table
CREATE POLICY "Users can view credentials for own organization integrations" ON integration_credentials
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage credentials for own organization integrations" ON integration_credentials
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for webhook_endpoints table
CREATE POLICY "Users can view webhooks for own organization integrations" ON webhook_endpoints
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage webhooks for own organization integrations" ON webhook_endpoints
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for integration_logs table
CREATE POLICY "Users can view logs for own organization" ON integration_logs
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert logs" ON integration_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for sync_jobs table
CREATE POLICY "Users can view sync jobs for own organization" ON sync_jobs
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sync jobs for own organization" ON sync_jobs
  FOR INSERT WITH CHECK (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can update sync jobs" ON sync_jobs
  FOR UPDATE USING (true);

-- RLS Policies for rate_limit_buckets table
-- Only service role can access rate limit buckets
CREATE POLICY "Service role only for rate limits" ON rate_limit_buckets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.jwt() AS jwt
      WHERE jwt.role = 'service_role'
    )
  );

-- Functions for credential encryption using Supabase Vault
CREATE OR REPLACE FUNCTION encrypt_credential(
  p_credential TEXT,
  p_key_id TEXT DEFAULT 'app-secret-key'
) RETURNS TEXT AS $$
DECLARE
  nonce bytea;
  encrypted_data bytea;
BEGIN
  -- Generate a random nonce for each encryption
  nonce := gen_random_bytes(24);
  
  -- Encrypt the credential
  encrypted_data := pgsodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    p_credential::bytea,
    ''::bytea, -- Additional authenticated data
    nonce,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p_key_id)::bytea
  );
  
  -- Return base64 encoded nonce + encrypted data
  RETURN encode(nonce || encrypted_data, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_credential(
  p_encrypted TEXT,
  p_key_id TEXT DEFAULT 'app-secret-key'
) RETURNS TEXT AS $$
DECLARE
  decoded_data bytea;
  nonce bytea;
  encrypted_data bytea;
  decrypted_data bytea;
BEGIN
  -- Decode from base64
  decoded_data := decode(p_encrypted, 'base64');
  
  -- Extract nonce (first 24 bytes) and encrypted data
  nonce := substr(decoded_data, 1, 24);
  encrypted_data := substr(decoded_data, 25);
  
  -- Decrypt the credential
  decrypted_data := pgsodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    encrypted_data,
    ''::bytea, -- Additional authenticated data
    nonce,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p_key_id)::bytea
  );
  
  RETURN convert_from(decrypted_data, 'utf8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old rate limit buckets
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_buckets()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_buckets
  WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_integration_id UUID,
  p_bucket_key TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER DEFAULT 3600
) RETURNS BOOLEAN AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_result BOOLEAN;
BEGIN
  -- Calculate window start
  v_window_start := date_trunc('hour', NOW());
  
  -- Get or create bucket
  INSERT INTO rate_limit_buckets (
    integration_id,
    bucket_key,
    window_start,
    window_duration_seconds,
    request_count,
    max_requests
  )
  VALUES (
    p_integration_id,
    p_bucket_key,
    v_window_start,
    p_window_seconds,
    1,
    p_max_requests
  )
  ON CONFLICT (integration_id, bucket_key, window_start)
  DO UPDATE SET request_count = rate_limit_buckets.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  -- Check if limit exceeded
  v_result := v_current_count <= p_max_requests;
  
  -- Clean up old buckets occasionally
  IF random() < 0.01 THEN
    PERFORM cleanup_old_rate_limit_buckets();
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_credentials_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log integration activity
CREATE OR REPLACE FUNCTION log_integration_activity(
  p_integration_id UUID,
  p_organization_id UUID,
  p_log_type TEXT,
  p_severity TEXT,
  p_message TEXT,
  p_details JSONB DEFAULT '{}',
  p_request_id TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO integration_logs (
    integration_id,
    organization_id,
    log_type,
    severity,
    message,
    details,
    request_id,
    duration_ms
  )
  VALUES (
    p_integration_id,
    p_organization_id,
    p_log_type,
    p_severity,
    p_message,
    p_details,
    p_request_id,
    p_duration_ms
  )
  RETURNING id INTO v_log_id;
  
  -- Update integration error tracking if this is an error
  IF p_severity IN ('error', 'critical') THEN
    UPDATE integrations
    SET error_count = error_count + 1,
        last_error_at = NOW()
    WHERE id = p_integration_id;
  END IF;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create or update a sync job
CREATE OR REPLACE FUNCTION create_sync_job(
  p_integration_id UUID,
  p_organization_id UUID,
  p_job_type TEXT,
  p_payload JSONB DEFAULT '{}',
  p_priority INTEGER DEFAULT 5,
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO sync_jobs (
    integration_id,
    organization_id,
    job_type,
    payload,
    priority,
    scheduled_for
  )
  VALUES (
    p_integration_id,
    p_organization_id,
    p_job_type,
    p_payload,
    p_priority,
    p_scheduled_for
  )
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE integrations IS 'Stores configuration for all external integrations';
COMMENT ON TABLE integration_credentials IS 'Stores encrypted credentials for integrations';
COMMENT ON TABLE webhook_endpoints IS 'Webhook configuration for receiving external events';
COMMENT ON TABLE integration_logs IS 'Audit trail and debugging logs for integrations';
COMMENT ON TABLE sync_jobs IS 'Queue for sync operations between systems';
COMMENT ON TABLE rate_limit_buckets IS 'Tracks API rate limits per integration';

COMMENT ON FUNCTION encrypt_credential IS 'Encrypts sensitive credentials using Supabase Vault';
COMMENT ON FUNCTION decrypt_credential IS 'Decrypts credentials stored with encrypt_credential';
COMMENT ON FUNCTION check_rate_limit IS 'Checks and updates rate limit for an integration';
COMMENT ON FUNCTION log_integration_activity IS 'Logs integration activity with automatic error tracking';
COMMENT ON FUNCTION create_sync_job IS 'Creates a new sync job in the queue';