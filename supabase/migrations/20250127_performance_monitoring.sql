-- PRP-016: Performance Monitoring System
-- Create performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('database_query', 'api_request', 'page_load', 'sync_job')),
  metric_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance queries
CREATE INDEX idx_performance_metrics_org_type ON performance_metrics(organization_id, metric_type);
CREATE INDEX idx_performance_metrics_created_at ON performance_metrics(created_at DESC);
CREATE INDEX idx_performance_metrics_slow_queries ON performance_metrics(organization_id, duration_ms DESC) 
  WHERE metric_type = 'database_query' AND duration_ms > 1000;
CREATE INDEX idx_performance_metrics_error_rate ON performance_metrics(organization_id, success, created_at) 
  WHERE success = false;

-- Enable RLS
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own performance metrics" ON performance_metrics
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can delete old performance metrics" ON performance_metrics
  FOR DELETE USING (true);

-- Create function to get performance summary
CREATE OR REPLACE FUNCTION get_performance_summary(
  p_organization_id UUID,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  avg_response_time DECIMAL,
  success_rate DECIMAL,
  error_rate DECIMAL,
  total_requests BIGINT,
  slow_queries_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH metrics_summary AS (
    SELECT 
      AVG(duration_ms) as avg_duration,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE success = true) as success_count,
      COUNT(*) FILTER (WHERE duration_ms > 1000) as slow_count
    FROM performance_metrics
    WHERE organization_id = p_organization_id
      AND created_at >= NOW() - INTERVAL '1 hour' * p_hours
  )
  SELECT 
    COALESCE(avg_duration, 0),
    CASE 
      WHEN total_count > 0 THEN (success_count::DECIMAL / total_count) * 100
      ELSE 100
    END,
    CASE 
      WHEN total_count > 0 THEN ((total_count - success_count)::DECIMAL / total_count) * 100
      ELSE 0
    END,
    COALESCE(total_count, 0),
    COALESCE(slow_count, 0)
  FROM metrics_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get slow queries
CREATE OR REPLACE FUNCTION get_slow_queries(
  p_organization_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  query TEXT,
  duration_ms INTEGER,
  table_name TEXT,
  operation TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.metadata->>'query' as query,
    pm.duration_ms,
    pm.metadata->>'table_name' as table_name,
    pm.metadata->>'operation' as operation,
    pm.created_at
  FROM performance_metrics pm
  WHERE pm.organization_id = p_organization_id
    AND pm.metric_type = 'database_query'
    AND pm.duration_ms > 1000
  ORDER BY pm.duration_ms DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get top endpoints
CREATE OR REPLACE FUNCTION get_top_endpoints(
  p_organization_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  endpoint TEXT,
  avg_duration DECIMAL,
  request_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.metric_name as endpoint,
    AVG(pm.duration_ms) as avg_duration,
    COUNT(*) as request_count
  FROM performance_metrics pm
  WHERE pm.organization_id = p_organization_id
    AND pm.metric_type = 'api_request'
  GROUP BY pm.metric_name
  ORDER BY avg_duration DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON performance_metrics TO authenticated;
GRANT INSERT ON performance_metrics TO authenticated;
GRANT DELETE ON performance_metrics TO service_role;

-- Create cleanup job for old metrics
CREATE OR REPLACE FUNCTION cleanup_old_performance_metrics()
RETURNS void AS $$
BEGIN
  DELETE FROM performance_metrics 
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 