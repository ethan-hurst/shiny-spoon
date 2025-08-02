-- Performance Optimization Schema (PRP-023)

-- Performance metrics table (optional - for tracking)
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_delta NUMERIC,
  metric_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  rating TEXT CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Partition by date for better performance
  created_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);

-- Create index for querying
CREATE INDEX idx_performance_metrics_date ON performance_metrics(created_date DESC);
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name, created_date DESC);

-- Materialized view for inventory summary
CREATE MATERIALIZED VIEW inventory_summary AS
SELECT 
  p.id,
  p.organization_id,
  p.name,
  p.sku,
  p.price,
  COALESCE(SUM(i.quantity), 0) as total_quantity,
  COALESCE(SUM(i.quantity * p.price), 0) as total_value,
  COUNT(DISTINCT i.warehouse_id) as warehouse_count,
  MIN(i.quantity) as min_quantity,
  MAX(i.quantity) as max_quantity,
  CASE 
    WHEN COALESCE(SUM(i.quantity), 0) = 0 THEN 'out_of_stock'
    WHEN COALESCE(SUM(i.quantity), 0) < p.reorder_point THEN 'low_stock'
    ELSE 'in_stock'
  END as stock_status
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
WHERE p.is_archived = FALSE
GROUP BY p.id, p.organization_id, p.name, p.sku, p.price, p.reorder_point;

-- Indexes for materialized view
CREATE INDEX idx_inventory_summary_org ON inventory_summary(organization_id);
CREATE INDEX idx_inventory_summary_sku ON inventory_summary(organization_id, sku);
CREATE INDEX idx_inventory_summary_status ON inventory_summary(organization_id, stock_status);
CREATE INDEX idx_inventory_summary_quantity ON inventory_summary(organization_id, total_quantity);

-- Materialized view for order analytics
CREATE MATERIALIZED VIEW order_analytics AS
SELECT 
  o.organization_id,
  o.warehouse_id,
  DATE_TRUNC('day', o.created_at) as order_date,
  COUNT(*) as order_count,
  SUM(o.total) as total_revenue,
  AVG(o.total) as avg_order_value,
  COUNT(DISTINCT o.customer_id) as unique_customers
FROM orders o
WHERE o.status != 'cancelled'
GROUP BY o.organization_id, o.warehouse_id, DATE_TRUNC('day', o.created_at);

-- Indexes for order analytics
CREATE INDEX idx_order_analytics_org_date ON order_analytics(organization_id, order_date DESC);
CREATE INDEX idx_order_analytics_warehouse ON order_analytics(warehouse_id, order_date DESC);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY order_analytics;
END;
$$ LANGUAGE plpgsql;

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_org_search ON products(organization_id, name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_products_org_sku ON products(organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_product_warehouse ON inventory(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_created ON orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id);

-- Optimize existing indexes
REINDEX INDEX CONCURRENTLY idx_products_organization_id;
REINDEX INDEX CONCURRENTLY idx_inventory_organization_id;
REINDEX INDEX CONCURRENTLY idx_orders_organization_id;

-- Add partial indexes for common filters
CREATE INDEX idx_products_active ON products(organization_id) WHERE is_archived = FALSE;
CREATE INDEX idx_orders_pending ON orders(organization_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_inventory_low_stock ON inventory(organization_id, product_id) WHERE quantity < reorder_point;

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_slow_queries(threshold_ms INTEGER DEFAULT 1000)
RETURNS TABLE(
  query TEXT,
  calls BIGINT,
  total_time NUMERIC,
  mean_time NUMERIC,
  max_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_stat_statements.query,
    pg_stat_statements.calls,
    pg_stat_statements.total_exec_time as total_time,
    pg_stat_statements.mean_exec_time as mean_time,
    pg_stat_statements.max_exec_time as max_time
  FROM pg_stat_statements
  WHERE pg_stat_statements.mean_exec_time > threshold_ms
  ORDER BY pg_stat_statements.mean_exec_time DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Enable query statistics extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create a background job to refresh materialized views periodically
-- This would be called by a cron job or scheduled function
COMMENT ON FUNCTION refresh_materialized_views() IS 'Call this function every hour to refresh materialized views';

-- RLS policies for performance metrics
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own metrics" ON performance_metrics
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

CREATE POLICY "Users can view own metrics" ON performance_metrics
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id IS NULL OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('admin', 'owner')
    )
  );