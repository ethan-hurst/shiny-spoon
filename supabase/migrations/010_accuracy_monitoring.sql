-- PRP-016: Data Accuracy Monitor Database Schema

-- Accuracy check runs
CREATE TABLE accuracy_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Check details
  check_type TEXT NOT NULL, -- 'scheduled', 'manual', 'triggered'
  scope TEXT NOT NULL, -- 'full', 'inventory', 'pricing', 'products'
  integration_id UUID REFERENCES integrations(id),

  -- Results
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  accuracy_score DECIMAL(5,2), -- 0-100
  discrepancies_found INTEGER DEFAULT 0,
  records_checked INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Related sync job
  sync_job_id UUID REFERENCES sync_jobs(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detected discrepancies
CREATE TABLE discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accuracy_check_id UUID REFERENCES accuracy_checks(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Discrepancy details
  entity_type TEXT NOT NULL, -- 'product', 'inventory', 'price', 'customer'
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,

  -- Values
  source_value JSONB,
  target_value JSONB,
  expected_value JSONB,

  -- Analysis
  discrepancy_type TEXT NOT NULL, -- 'missing', 'mismatch', 'stale', 'duplicate'
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence_score DECIMAL(3,2), -- 0-1

  -- Resolution
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')),
  resolution_type TEXT, -- 'auto_fixed', 'manual_fixed', 'false_positive'
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  -- Metadata
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Alert rules configuration
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Rule details
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Conditions
  entity_type TEXT[], -- Types to monitor
  severity_threshold TEXT DEFAULT 'medium',
  accuracy_threshold DECIMAL(5,2) DEFAULT 95.00,
  discrepancy_count_threshold INTEGER DEFAULT 10,

  -- Time windows
  check_frequency INTEGER DEFAULT 3600, -- seconds
  evaluation_window INTEGER DEFAULT 3600, -- seconds for aggregation

  -- Actions
  notification_channels TEXT[] DEFAULT '{"in_app"}',
  auto_remediate BOOLEAN DEFAULT false,
  escalation_policy JSONB DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Alert instances
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID REFERENCES alert_rules(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Alert details
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,

  -- Trigger data
  triggered_by TEXT NOT NULL, -- 'threshold', 'anomaly', 'pattern'
  trigger_value JSONB NOT NULL,
  accuracy_check_id UUID REFERENCES accuracy_checks(id),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'snoozed')),
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Notifications
  notifications_sent JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification log
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id) NOT NULL,

  -- Notification details
  channel TEXT NOT NULL, -- 'email', 'sms', 'in_app', 'webhook'
  recipient TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL, -- 'pending', 'sent', 'delivered', 'failed'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Response
  provider_response JSONB,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-remediation log
CREATE TABLE remediation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discrepancy_id UUID REFERENCES discrepancies(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Action details
  action_type TEXT NOT NULL, -- 'sync_retry', 'value_update', 'cache_clear', etc.
  action_config JSONB NOT NULL,

  -- Execution
  status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results
  success BOOLEAN,
  result JSONB,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accuracy metrics time series
CREATE TABLE accuracy_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  integration_id UUID REFERENCES integrations(id),

  -- Metrics
  accuracy_score DECIMAL(5,2) NOT NULL,
  total_records INTEGER NOT NULL,
  discrepancy_count INTEGER NOT NULL,

  -- Breakdown by type
  metrics_by_type JSONB DEFAULT '{}', -- {inventory: 98.5, pricing: 96.2}

  -- Time bucket
  metric_timestamp TIMESTAMPTZ NOT NULL,
  bucket_duration INTEGER NOT NULL, -- seconds (300 = 5min, 3600 = 1hr)

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_accuracy_checks_org_status ON accuracy_checks(organization_id, status);
CREATE INDEX idx_discrepancies_check ON discrepancies(accuracy_check_id);
CREATE INDEX idx_discrepancies_entity ON discrepancies(entity_type, entity_id);
CREATE INDEX idx_alerts_org_status ON alerts(organization_id, status);
CREATE INDEX idx_accuracy_metrics_time ON accuracy_metrics(organization_id, metric_timestamp DESC);

-- RLS Policies

-- Accuracy checks
ALTER TABLE accuracy_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's accuracy checks"
  ON accuracy_checks FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create accuracy checks for their organization"
  ON accuracy_checks FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their organization's accuracy checks"
  ON accuracy_checks FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

-- Discrepancies
ALTER TABLE discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's discrepancies"
  ON discrepancies FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create discrepancies for their organization"
  ON discrepancies FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their organization's discrepancies"
  ON discrepancies FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

-- Alert rules
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's alert rules"
  ON alert_rules FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create alert rules for their organization"
  ON alert_rules FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their organization's alert rules"
  ON alert_rules FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their organization's alert rules"
  ON alert_rules FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

-- Alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's alerts"
  ON alerts FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create alerts for their organization"
  ON alerts FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their organization's alerts"
  ON alerts FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

-- Notification log
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications for their organization's alerts"
  ON notification_log FOR SELECT
  USING (alert_id IN (
    SELECT id FROM alerts 
    WHERE organization_id IN (
      SELECT organization_id FROM organization_users 
      WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "System can create notification logs"
  ON notification_log FOR INSERT
  WITH CHECK (true);

-- Remediation log
ALTER TABLE remediation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's remediation logs"
  ON remediation_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can create remediation logs"
  ON remediation_log FOR INSERT
  WITH CHECK (true);

-- Accuracy metrics
ALTER TABLE accuracy_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's accuracy metrics"
  ON accuracy_metrics FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create accuracy metrics for their organization"
  ON accuracy_metrics FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));

-- Helper functions for calculations

-- Function to calculate accuracy score
CREATE OR REPLACE FUNCTION calculate_accuracy_score(
  total_records INTEGER,
  discrepancy_count INTEGER
) RETURNS DECIMAL(5,2) AS $$
BEGIN
  IF total_records = 0 THEN
    RETURN 100.00;
  END IF;
  
  RETURN GREATEST(0, LEAST(100, ((total_records::DECIMAL - discrepancy_count::DECIMAL) / total_records::DECIMAL) * 100));
END;
$$ LANGUAGE plpgsql;

-- Function to get current organization's accuracy score
CREATE OR REPLACE FUNCTION get_current_accuracy_score(org_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  latest_score DECIMAL(5,2);
BEGIN
  SELECT accuracy_score INTO latest_score
  FROM accuracy_checks
  WHERE organization_id = org_id
    AND status = 'completed'
  ORDER BY completed_at DESC
  LIMIT 1;
  
  RETURN COALESCE(latest_score, 100.00);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();