-- PRP-018: Analytics Dashboard - Database Schema
-- Comprehensive analytics metrics storage for business insights

-- Analytics metrics storage
CREATE TABLE analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('order_accuracy', 'sync_performance', 'inventory_level', 'revenue_impact')),
  metric_date DATE NOT NULL,

  -- Order accuracy metrics
  total_orders INTEGER,
  accurate_orders INTEGER,
  error_count INTEGER,
  accuracy_rate DECIMAL(5,2),

  -- Sync performance metrics
  sync_count INTEGER,
  sync_duration_ms INTEGER,
  sync_failures INTEGER,
  avg_latency_ms INTEGER,

  -- Inventory metrics
  total_skus INTEGER,
  low_stock_count INTEGER,
  out_of_stock_count INTEGER,
  inventory_value DECIMAL(15,2),

  -- Revenue impact
  revenue_saved DECIMAL(15,2),
  errors_prevented INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, metric_type, metric_date)
);

-- Detailed sync logs for performance analysis
CREATE TABLE sync_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  sync_job_id UUID REFERENCES sync_jobs(id),
  integration_id UUID REFERENCES integrations(id),

  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  records_processed INTEGER,
  records_failed INTEGER,

  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  error_details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory snapshots for trend analysis
CREATE TABLE inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  snapshot_date DATE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id),
  product_id UUID REFERENCES products(id),

  quantity INTEGER NOT NULL,
  reserved_quantity INTEGER,
  value DECIMAL(15,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, snapshot_date, warehouse_id, product_id)
);

-- Indexes for performance
CREATE INDEX idx_analytics_metrics_org_date ON analytics_metrics(organization_id, metric_date DESC);
CREATE INDEX idx_analytics_metrics_type ON analytics_metrics(metric_type, metric_date DESC);
CREATE INDEX idx_sync_performance_org_date ON sync_performance_logs(organization_id, started_at DESC);
CREATE INDEX idx_inventory_snapshots_date ON inventory_snapshots(organization_id, snapshot_date DESC);

-- RLS Policies
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics" ON analytics_metrics
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own sync logs" ON sync_performance_logs
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own inventory snapshots" ON inventory_snapshots
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Insert policies for system updates
CREATE POLICY "System can insert analytics" ON analytics_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can insert sync logs" ON sync_performance_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can insert inventory snapshots" ON inventory_snapshots
  FOR INSERT WITH CHECK (true);

-- Update policies for system updates
CREATE POLICY "System can update analytics" ON analytics_metrics
  FOR UPDATE USING (true);

CREATE POLICY "System can update sync logs" ON sync_performance_logs
  FOR UPDATE USING (true);