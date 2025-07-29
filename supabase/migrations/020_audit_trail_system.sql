-- PRP-020: Comprehensive Audit Trail and Compliance System
-- This migration creates a complete audit logging infrastructure

-- Drop existing audit_logs if it exists to recreate with proper schema
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Generic audit logs table for all actions
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Actor information
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT,

  -- Action details
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'delete', 'view', 'export',
    'login', 'logout', 'invite', 'sync', 'approve', 'reject'
  )),
  entity_type TEXT NOT NULL, -- 'product', 'inventory', 'order', 'customer', etc.
  entity_id UUID,
  entity_name TEXT, -- Human-readable identifier

  -- Change details
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}', -- Additional context (IP, user agent, etc.)

  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- View for audit logs with user details
CREATE VIEW audit_logs_with_details AS
SELECT
  al.*,
  up.full_name as user_name,
  up.avatar_url as user_avatar,
  o.name as organization_name
FROM audit_logs al
LEFT JOIN user_profiles up ON al.user_id = up.user_id
LEFT JOIN organizations o ON al.organization_id = o.id;

-- Data retention table
CREATE TABLE audit_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  entity_type TEXT,
  retention_days INTEGER NOT NULL DEFAULT 365,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, entity_type)
);

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_retention_policies ENABLE ROW LEVEL SECURITY;

-- Users can only view their organization's audit logs
CREATE POLICY "View organization audit logs" ON audit_logs
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Only system can insert audit logs (via service)
CREATE POLICY "System insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Only admins can manage retention policies
CREATE POLICY "Admin manage retention policies" ON audit_retention_policies
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Function to clean up old audit logs based on retention policies
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs al
  WHERE EXISTS (
    SELECT 1 FROM audit_retention_policies arp
    WHERE arp.organization_id = al.organization_id
    AND (arp.entity_type = al.entity_type OR arp.entity_type IS NULL)
    AND arp.is_active = true
    AND al.created_at < NOW() - (arp.retention_days || ' days')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log(
  p_organization_id UUID,
  p_user_id UUID,
  p_user_email TEXT,
  p_user_role TEXT,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    organization_id,
    user_id,
    user_email,
    user_role,
    action,
    entity_type,
    entity_id,
    entity_name,
    old_values,
    new_values,
    metadata,
    ip_address,
    user_agent,
    request_id
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_user_email,
    p_user_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_old_values,
    p_new_values,
    p_metadata,
    p_ip_address,
    p_user_agent,
    p_request_id
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION create_audit_log TO service_role;

-- Insert default retention policies for new organizations
INSERT INTO audit_retention_policies (organization_id, entity_type, retention_days)
SELECT DISTINCT organization_id, NULL, 365
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM audit_retention_policies
  WHERE audit_retention_policies.organization_id = organizations.id
  AND entity_type IS NULL
);

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all user actions and system events';
COMMENT ON TABLE audit_retention_policies IS 'Data retention policies for audit logs by organization and entity type';
COMMENT ON FUNCTION cleanup_audit_logs IS 'Removes audit logs older than retention policy allows';
COMMENT ON FUNCTION create_audit_log IS 'Helper function to create standardized audit log entries';