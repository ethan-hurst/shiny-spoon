-- Enable supa_audit extension (preferred approach)
CREATE EXTENSION IF NOT EXISTS supa_audit CASCADE;

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

-- Enable supa_audit on critical tables
SELECT audit.enable_tracking('public.products'::regclass);
SELECT audit.enable_tracking('public.inventory'::regclass);
SELECT audit.enable_tracking('public.orders'::regclass);
SELECT audit.enable_tracking('public.pricing_rules'::regclass);
SELECT audit.enable_tracking('public.customers'::regclass);
SELECT audit.enable_tracking('public.warehouses'::regclass);

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

-- Indexes for performance
CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

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