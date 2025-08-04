-- Core Schema Migration
-- This migration consolidates all core tables and resolves conflicts
-- Should be run after 000_core_functions.sql

-- =============================================
-- CORE TABLES
-- =============================================

-- Organizations table (multi-tenant root)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_tier TEXT DEFAULT 'starter' 
    CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  subscription_status TEXT DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'member' 
    CHECK (role IN ('owner', 'admin', 'member')),
  permissions JSONB DEFAULT '{}',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products catalog
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  base_price DECIMAL(12,2) DEFAULT 0 CHECK (base_price >= 0),
  cost DECIMAL(12,2) DEFAULT 0 CHECK (cost >= 0),
  weight DECIMAL(10,3),
  dimensions JSONB DEFAULT '{}',
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_sku_per_org UNIQUE(organization_id, sku)
);

-- Warehouse locations
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address JSONB DEFAULT '{}',
  contact JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_warehouse_code UNIQUE(organization_id, code)
);

-- Inventory levels
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
  reorder_point INTEGER,
  reorder_quantity INTEGER,
  last_counted_at TIMESTAMPTZ,
  last_counted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_product_warehouse UNIQUE(product_id, warehouse_id),
  CONSTRAINT reserved_not_greater_than_quantity CHECK (reserved_quantity <= quantity)
);

-- =============================================
-- AUDIT AND LOGGING TABLES
-- =============================================

-- Consolidated audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
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

-- Data retention table
CREATE TABLE IF NOT EXISTS audit_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  entity_type TEXT,
  retention_days INTEGER NOT NULL DEFAULT 365,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, entity_type)
);

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_message TEXT NOT NULL,
  error_code TEXT,
  stack_trace TEXT,
  context JSONB DEFAULT '{}',
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SECURITY TABLES
-- =============================================

-- Consolidated API keys table
CREATE TABLE IF NOT EXISTS api_keys (
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

-- API key usage table
CREATE TABLE IF NOT EXISTS api_key_usage (
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

-- Access logs table
CREATE TABLE IF NOT EXISTS access_logs (
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

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
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

-- Security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
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

-- =============================================
-- PERFORMANCE AND MONITORING TABLES
-- =============================================

-- Consolidated performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  metric_unit TEXT,
  tags JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Organizations policies
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = get_user_organization_id(auth.uid()));

CREATE POLICY "Only owners can update organization"
  ON organizations FOR UPDATE
  USING (
    id = get_user_organization_id(auth.uid()) 
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND organization_id = id 
      AND role = 'owner'
    )
  );

-- User profiles policies  
CREATE POLICY "Users can view profiles in their org"
  ON user_profiles FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can insert profiles in their org"
  ON user_profiles FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND is_org_admin(auth.uid(), organization_id)
  );

CREATE POLICY "Admins can update profiles in their org"
  ON user_profiles FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND is_org_admin(auth.uid(), organization_id)
  );

-- Products policies
CREATE POLICY "Users can view products in their org"
  ON products FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert products in their org"
  ON products FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update products in their org"
  ON products FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Warehouses policies
CREATE POLICY "Users can view warehouses in their org"
  ON warehouses FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage warehouses in their org"
  ON warehouses FOR ALL
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND is_org_admin(auth.uid(), organization_id)
  );

-- Inventory policies
CREATE POLICY "Users can view inventory in their org"
  ON inventory FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update inventory in their org"
  ON inventory FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert inventory in their org"
  ON inventory FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

-- Audit logs policies
CREATE POLICY "Users can view their organization's audit logs" ON audit_logs
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Error logs policies
CREATE POLICY "Users can view their organization's error logs" ON error_logs
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "System can insert error logs" ON error_logs
  FOR INSERT WITH CHECK (true);

-- API keys policies
CREATE POLICY "Users can view their organization's API keys" ON api_keys
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "Users can manage their organization's API keys" ON api_keys
  FOR ALL USING (
    organization_id = get_user_organization_id(auth.uid())
  );

-- API key usage policies
CREATE POLICY "Users can view their organization's API key usage" ON api_key_usage
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "System can insert API key usage" ON api_key_usage
  FOR INSERT WITH CHECK (true);

-- Access logs policies
CREATE POLICY "Users can view their organization's access logs" ON access_logs
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "System can insert access logs" ON access_logs
  FOR INSERT WITH CHECK (true);

-- Security events policies
CREATE POLICY "Users can view their organization's security events" ON security_events
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "System can insert security events" ON security_events
  FOR INSERT WITH CHECK (true);

-- Security alerts policies
CREATE POLICY "Users can view their organization's security alerts" ON security_alerts
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "Users can update their organization's security alerts" ON security_alerts
  FOR UPDATE USING (
    organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "System can insert security alerts" ON security_alerts
  FOR INSERT WITH CHECK (true);

-- Performance metrics policies
CREATE POLICY "Users can view their organization's performance metrics" ON performance_metrics
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "System can insert performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (true);

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Add update timestamp triggers to all tables
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_retention_policies_updated_at
  BEFORE UPDATE ON audit_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_role ON user_profiles(organization_id, role);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org_sku ON products(organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_org_active ON products(organization_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_org_category ON products(organization_id, category);

-- Warehouses indexes
CREATE INDEX IF NOT EXISTS idx_warehouses_org_id ON warehouses(organization_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_org_code ON warehouses(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_warehouses_org_default ON warehouses(organization_id, is_default) WHERE is_default = true;

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_org_id ON inventory(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_id ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_warehouse ON inventory(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(organization_id, warehouse_id) 
  WHERE quantity <= reorder_point;
CREATE INDEX IF NOT EXISTS idx_inventory_org_product ON inventory(organization_id, product_id);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_organization ON api_keys(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(key_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_organization ON api_key_usage(organization_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_access_logs_organization ON access_logs(organization_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON access_logs(ip_address, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_organization ON security_events(organization_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_alerts_organization ON security_alerts(organization_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity, resolved);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_org_timestamp ON performance_metrics(organization_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_timestamp ON performance_metrics(metric_name, timestamp DESC);

-- =============================================
-- VIEWS
-- =============================================

-- View for audit logs with user details
CREATE OR REPLACE VIEW audit_logs_with_details AS
SELECT
  al.*,
  up.full_name as user_name,
  up.avatar_url as user_avatar,
  o.name as organization_name
FROM audit_logs al
LEFT JOIN user_profiles up ON al.user_id = up.user_id
LEFT JOIN organizations o ON al.organization_id = o.id;

-- =============================================
-- INITIAL DATA / CONFIGURATION
-- =============================================

-- Note: Default retention policies will be created by the handle_new_user function
-- when organizations are created, so no initial data is needed here

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE organizations IS 'Multi-tenant root table for all organizations';
COMMENT ON TABLE user_profiles IS 'User profiles extending auth.users with organization context';
COMMENT ON TABLE products IS 'Product catalog with organization isolation';
COMMENT ON TABLE warehouses IS 'Warehouse locations with organization isolation';
COMMENT ON TABLE inventory IS 'Inventory levels with product and warehouse relationships';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all user actions and system events';
COMMENT ON TABLE error_logs IS 'Error logging for debugging and monitoring';
COMMENT ON TABLE api_keys IS 'API key management with rate limiting and permissions';
COMMENT ON TABLE security_events IS 'Security event logging for threat detection';
COMMENT ON TABLE performance_metrics IS 'Performance monitoring and metrics collection'; 