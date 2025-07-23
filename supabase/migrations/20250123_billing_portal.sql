-- Customer billing information
CREATE TABLE IF NOT EXISTS customer_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')),
  subscription_tier TEXT CHECK (subscription_tier IN ('starter', 'growth', 'scale')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 7 characters for display
  permissions TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT valid_permissions CHECK (
    permissions <@ ARRAY['read:products', 'write:products', 'read:inventory', 'write:inventory', 'read:pricing', 'write:pricing', 'read:customers', 'write:customers']::TEXT[]
  )
);

-- Usage metrics table for tracking API calls and feature usage
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('api_calls', 'products', 'warehouses', 'sync_runs')),
  metric_value INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, metric_type, period_start)
);

-- Team invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email_billing BOOLEAN DEFAULT true,
  email_usage_alerts BOOLEAN DEFAULT true,
  email_sync_errors BOOLEAN DEFAULT true,
  email_team_updates BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- API call logs for tracking usage
CREATE TABLE IF NOT EXISTS api_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_customer_billing_org_id ON customer_billing(organization_id);
CREATE INDEX idx_customer_billing_stripe_customer ON customer_billing(stripe_customer_id);
CREATE INDEX idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX idx_usage_metrics_org_period ON usage_metrics(organization_id, period_start);
CREATE INDEX idx_team_invitations_org_id ON team_invitations(organization_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_notification_prefs_user_org ON notification_preferences(user_id, organization_id);
CREATE INDEX idx_api_call_logs_org_created ON api_call_logs(organization_id, created_at);
CREATE INDEX idx_api_call_logs_api_key ON api_call_logs(api_key_id);

-- RLS Policies for customer_billing
ALTER TABLE customer_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization billing" ON customer_billing
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update billing" ON customer_billing
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization API keys" ON api_keys
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage API keys" ON api_keys
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for usage_metrics
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization usage" ON usage_metrics
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for team_invitations
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization invitations" ON team_invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    ) OR email = auth.jwt()->>'email'
  );

CREATE POLICY "Admins can manage invitations" ON team_invitations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for api_call_logs
ALTER TABLE api_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization API logs" ON api_call_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Functions for API key management
CREATE OR REPLACE FUNCTION generate_api_key_prefix(key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN SUBSTRING(key FROM 1 FOR 7);
END;
$$ LANGUAGE plpgsql;

-- Function to update usage metrics
CREATE OR REPLACE FUNCTION increment_usage_metric(
  p_organization_id UUID,
  p_metric_type TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Get current billing period (assuming monthly)
  v_period_start := DATE_TRUNC('month', CURRENT_DATE);
  v_period_end := (v_period_start + INTERVAL '1 month')::DATE - 1;
  
  -- Upsert the metric
  INSERT INTO usage_metrics (organization_id, metric_type, metric_value, period_start, period_end)
  VALUES (p_organization_id, p_metric_type, p_increment, v_period_start, v_period_end)
  ON CONFLICT (organization_id, metric_type, period_start)
  DO UPDATE SET 
    metric_value = usage_metrics.metric_value + p_increment,
    period_end = v_period_end;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_billing_updated_at
  BEFORE UPDATE ON customer_billing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();