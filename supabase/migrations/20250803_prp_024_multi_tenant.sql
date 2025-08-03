-- Enhanced tenant isolation with performance optimizations (PRP-024)

-- Add tenant sharding hint
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS shard_key INTEGER;

-- Function to calculate shard key
CREATE OR REPLACE FUNCTION calculate_shard_key(org_id UUID)
RETURNS INTEGER AS $$
BEGIN
  -- Simple modulo sharding for demonstration
  -- In production, use consistent hashing
  RETURN abs(hashtext(org_id::text)) % 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing organizations
UPDATE organizations 
SET shard_key = calculate_shard_key(id)
WHERE shard_key IS NULL;

-- Create index for shard-based queries
CREATE INDEX idx_organizations_shard ON organizations(shard_key);

-- Tenant usage tracking with partitioning
CREATE TABLE IF NOT EXISTS tenant_usage (
  id UUID DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Partition by month for efficient cleanup
  created_month DATE GENERATED ALWAYS AS (DATE_TRUNC('month', measured_at)) STORED,
  
  PRIMARY KEY (id, created_month)
) PARTITION BY RANGE (created_month);

-- Create initial partitions
CREATE TABLE IF NOT EXISTS tenant_usage_2025_01 PARTITION OF tenant_usage
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS tenant_usage_2025_02 PARTITION OF tenant_usage
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS tenant_usage_2025_03 PARTITION OF tenant_usage
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create indexes on partitions
CREATE INDEX idx_tenant_usage_2025_01_org ON tenant_usage_2025_01(organization_id, measured_at DESC);
CREATE INDEX idx_tenant_usage_2025_02_org ON tenant_usage_2025_02(organization_id, measured_at DESC);
CREATE INDEX idx_tenant_usage_2025_03_org ON tenant_usage_2025_03(organization_id, measured_at DESC);

-- Connection limits per tenant
CREATE TABLE IF NOT EXISTS tenant_limits (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  max_connections INTEGER DEFAULT 10,
  max_api_calls_per_hour INTEGER DEFAULT 10000,
  max_storage_gb INTEGER DEFAULT 100,
  max_users INTEGER DEFAULT 50,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'professional', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger to update timestamp
CREATE TRIGGER update_tenant_limits_updated_at
  BEFORE UPDATE ON tenant_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default limits for existing organizations
INSERT INTO tenant_limits (organization_id)
SELECT id FROM organizations
WHERE id NOT IN (SELECT organization_id FROM tenant_limits)
ON CONFLICT DO NOTHING;

-- Function to check tenant limits
CREATE OR REPLACE FUNCTION check_tenant_limit(
  org_id UUID,
  limit_type TEXT,
  current_value INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  limit_value INTEGER;
BEGIN
  CASE limit_type
    WHEN 'connections' THEN
      SELECT max_connections INTO limit_value
      FROM tenant_limits WHERE organization_id = org_id;
    WHEN 'api_calls' THEN
      SELECT max_api_calls_per_hour INTO limit_value
      FROM tenant_limits WHERE organization_id = org_id;
    WHEN 'users' THEN
      SELECT max_users INTO limit_value
      FROM tenant_limits WHERE organization_id = org_id;
    ELSE
      RETURN TRUE; -- Unknown limit type, allow
  END CASE;

  RETURN current_value < COALESCE(limit_value, 999999);
END;
$$ LANGUAGE plpgsql;

-- Function to get database statistics
CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS TABLE(
  active_connections INTEGER,
  idle_connections INTEGER,
  waiting_clients INTEGER,
  max_connections INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    count(*) FILTER (WHERE state = 'active')::INTEGER as active_connections,
    count(*) FILTER (WHERE state = 'idle')::INTEGER as idle_connections,
    count(*) FILTER (WHERE wait_event IS NOT NULL)::INTEGER as waiting_clients,
    setting::INTEGER as max_connections
  FROM pg_stat_activity
  CROSS JOIN pg_settings
  WHERE pg_settings.name = 'max_connections'
  GROUP BY setting;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tenant resource usage
CREATE OR REPLACE FUNCTION get_tenant_resource_usage(org_id UUID)
RETURNS TABLE(
  storage_used_gb NUMERIC,
  api_calls_this_hour INTEGER,
  active_users INTEGER,
  total_products INTEGER,
  total_orders INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Storage calculation (simplified)
    (SELECT COALESCE(SUM(pg_column_size(p.*)), 0) / 1024.0 / 1024.0 / 1024.0 
     FROM products p WHERE p.organization_id = org_id)::NUMERIC as storage_used_gb,
    
    -- API calls in last hour
    (SELECT COALESCE(SUM(metric_value), 0)::INTEGER 
     FROM tenant_usage 
     WHERE organization_id = org_id 
     AND metric_name LIKE 'api_call_%'
     AND measured_at > NOW() - INTERVAL '1 hour') as api_calls_this_hour,
    
    -- Active users
    (SELECT COUNT(DISTINCT up.user_id)::INTEGER 
     FROM user_profiles up 
     WHERE up.organization_id = org_id) as active_users,
    
    -- Total products
    (SELECT COUNT(*)::INTEGER 
     FROM products 
     WHERE organization_id = org_id) as total_products,
    
    -- Total orders
    (SELECT COUNT(*)::INTEGER 
     FROM orders 
     WHERE organization_id = org_id) as total_orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create composite indexes for tenant queries with shard key
CREATE INDEX IF NOT EXISTS idx_products_org_shard 
  ON products(organization_id, (SELECT shard_key FROM organizations WHERE id = products.organization_id));

CREATE INDEX IF NOT EXISTS idx_inventory_org_shard 
  ON inventory(organization_id, (SELECT shard_key FROM organizations WHERE id = inventory.organization_id));

CREATE INDEX IF NOT EXISTS idx_orders_org_shard 
  ON orders(organization_id, (SELECT shard_key FROM organizations WHERE id = orders.organization_id));

-- RLS policies for new tables
ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_limits ENABLE ROW LEVEL SECURITY;

-- Tenant usage policies
CREATE POLICY "Organizations can view own usage" ON tenant_usage
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert usage metrics" ON tenant_usage
  FOR INSERT WITH CHECK (true); -- Will be restricted by service role

-- Tenant limits policies
CREATE POLICY "Organizations can view own limits" ON tenant_limits
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can update limits" ON tenant_limits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND organization_id = tenant_limits.organization_id
      AND role IN ('admin', 'owner')
    )
  );

-- Function to automatically create partitions
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  partition_name TEXT;
BEGIN
  -- Calculate next month
  start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  end_date := start_date + INTERVAL '1 month';
  partition_name := 'tenant_usage_' || TO_CHAR(start_date, 'YYYY_MM');
  
  -- Check if partition exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = partition_name
  ) THEN
    -- Create partition
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF tenant_usage FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );
    
    -- Create index
    EXECUTE format(
      'CREATE INDEX %I ON %I(organization_id, measured_at DESC)',
      'idx_' || partition_name || '_org',
      partition_name
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule partition creation (would be called by cron job)
COMMENT ON FUNCTION create_monthly_partition() IS 'Run monthly to create new partitions';