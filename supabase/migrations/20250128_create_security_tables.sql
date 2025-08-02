-- Create API keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit INTEGER NOT NULL DEFAULT 1000,
  ip_whitelist TEXT[],
  
  -- Ensure unique names per organization
  CONSTRAINT unique_api_key_name_per_org UNIQUE (organization_id, name)
);

-- Create API key usage table
CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_time INTEGER NOT NULL, -- milliseconds
  status_code INTEGER NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL
);

-- Create IP rules table
CREATE TABLE ip_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  ip_address TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  
  -- Ensure unique IP per organization
  CONSTRAINT unique_ip_per_org UNIQUE (organization_id, ip_address)
);

-- Create access logs table
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time INTEGER NOT NULL, -- milliseconds
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT
);

-- Create security policies table
CREATE TABLE security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ip_whitelist', 'rate_limit', 'geo_block', 'user_agent_block')),
  rules JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique names per organization
  CONSTRAINT unique_policy_name_per_org UNIQUE (organization_id, name)
);

-- Create security events table
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('api_key_created', 'api_key_revoked', 'api_key_rotated', 'failed_auth', 'rate_limit_exceeded', 'suspicious_activity')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create security alerts table
CREATE TABLE security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('failed_auth', 'suspicious_ip', 'rate_limit_exceeded', 'api_key_abuse', 'geo_violation', 'unusual_pattern')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  resolved BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create threat intelligence table
CREATE TABLE threat_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  threat_score INTEGER NOT NULL DEFAULT 0 CHECK (threat_score >= 0 AND threat_score <= 100),
  threat_type TEXT[] NOT NULL DEFAULT '{}',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Ensure unique IP per organization
  CONSTRAINT unique_threat_ip_per_org UNIQUE (organization_id, ip_address)
);

-- Create indexes for performance
CREATE INDEX idx_api_keys_organization ON api_keys(organization_id, is_active);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_key_usage_key_id ON api_key_usage(key_id, timestamp);
CREATE INDEX idx_api_key_usage_organization ON api_key_usage(organization_id, timestamp);
CREATE INDEX idx_ip_rules_organization ON ip_rules(organization_id, is_active);
CREATE INDEX idx_access_logs_organization ON access_logs(organization_id, timestamp);
CREATE INDEX idx_access_logs_ip ON access_logs(ip_address, timestamp);
CREATE INDEX idx_security_policies_organization ON security_policies(organization_id, is_active);
CREATE INDEX idx_security_events_organization ON security_events(organization_id, timestamp);
CREATE INDEX idx_security_events_type ON security_events(type, timestamp);
CREATE INDEX idx_security_alerts_organization ON security_alerts(organization_id, timestamp);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity, resolved);
CREATE INDEX idx_threat_intelligence_organization ON threat_intelligence(organization_id, threat_score);

-- Create RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_intelligence ENABLE ROW LEVEL SECURITY;

-- API keys policies
CREATE POLICY "Users can view their organization's API keys" ON api_keys
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their organization's API keys" ON api_keys
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- API key usage policies
CREATE POLICY "Users can view their organization's API key usage" ON api_key_usage
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert API key usage" ON api_key_usage
  FOR INSERT WITH CHECK (true);

-- IP rules policies
CREATE POLICY "Users can view their organization's IP rules" ON ip_rules
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their organization's IP rules" ON ip_rules
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Access logs policies
CREATE POLICY "Users can view their organization's access logs" ON access_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert access logs" ON access_logs
  FOR INSERT WITH CHECK (true);

-- Security policies policies
CREATE POLICY "Users can view their organization's security policies" ON security_policies
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their organization's security policies" ON security_policies
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Security events policies
CREATE POLICY "Users can view their organization's security events" ON security_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert security events" ON security_events
  FOR INSERT WITH CHECK (true);

-- Security alerts policies
CREATE POLICY "Users can view their organization's security alerts" ON security_alerts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's security alerts" ON security_alerts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert security alerts" ON security_alerts
  FOR INSERT WITH CHECK (true);

-- Threat intelligence policies
CREATE POLICY "Users can view their organization's threat intelligence" ON threat_intelligence
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage threat intelligence" ON threat_intelligence
  FOR ALL USING (true);

-- Create functions for security features

-- Function to get API key statistics
CREATE OR REPLACE FUNCTION get_api_key_stats(
  org_id UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_keys', COUNT(*),
    'active_keys', COUNT(*) FILTER (WHERE is_active = TRUE),
    'expired_keys', COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW()),
    'keys_used_today', COUNT(*) FILTER (WHERE last_used_at >= CURRENT_DATE),
    'total_requests', COALESCE((
      SELECT COUNT(*) FROM api_key_usage 
      WHERE organization_id = org_id 
        AND timestamp >= NOW() - INTERVAL '1 day' * days_back
    ), 0),
    'avg_response_time', COALESCE((
      SELECT AVG(response_time) FROM api_key_usage 
      WHERE organization_id = org_id 
        AND timestamp >= NOW() - INTERVAL '1 day' * days_back
    ), 0)
  ) INTO result
  FROM api_keys
  WHERE organization_id = org_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get security metrics
CREATE OR REPLACE FUNCTION get_security_metrics(
  org_id UUID,
  days_back INTEGER DEFAULT 7
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_alerts', COALESCE((
      SELECT COUNT(*) FROM security_alerts 
      WHERE organization_id = org_id 
        AND timestamp >= NOW() - INTERVAL '1 day' * days_back
    ), 0),
    'critical_alerts', COALESCE((
      SELECT COUNT(*) FROM security_alerts 
      WHERE organization_id = org_id 
        AND severity = 'critical'
        AND timestamp >= NOW() - INTERVAL '1 day' * days_back
    ), 0),
    'failed_auth_attempts', COALESCE((
      SELECT COUNT(*) FROM access_logs 
      WHERE organization_id = org_id 
        AND status_code IN (401, 403)
        AND timestamp >= NOW() - INTERVAL '1 day' * days_back
    ), 0),
    'blocked_requests', COALESCE((
      SELECT COUNT(*) FROM access_logs 
      WHERE organization_id = org_id 
        AND blocked = TRUE
        AND timestamp >= NOW() - INTERVAL '1 day' * days_back
    ), 0),
    'suspicious_ips', COALESCE((
      SELECT COUNT(DISTINCT ip_address) FROM access_logs 
      WHERE organization_id = org_id 
        AND timestamp >= NOW() - INTERVAL '1 day' * days_back
    ), 0)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old security data
CREATE OR REPLACE FUNCTION cleanup_old_security_data(
  days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old access logs
  DELETE FROM access_logs 
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete old API key usage
  DELETE FROM api_key_usage 
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  -- Delete old security events
  DELETE FROM security_events 
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  -- Delete old security alerts (keep critical ones longer)
  DELETE FROM security_alerts 
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep
    AND severity != 'critical';
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_policies_updated_at
  BEFORE UPDATE ON security_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a cron job to clean up old security data (runs weekly)
SELECT cron.schedule(
  'cleanup-security-data',
  '0 3 * * 0', -- Weekly at 3 AM on Sunday
  'SELECT cleanup_old_security_data(90);'
); 