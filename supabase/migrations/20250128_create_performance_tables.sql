-- Create performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'ms',
  tags JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance alerts table
CREATE TABLE performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL,
  threshold DECIMAL(10, 2) NOT NULL,
  current_value DECIMAL(10, 2) NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cache statistics table
CREATE TABLE cache_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL,
  hits BIGINT NOT NULL DEFAULT 0,
  misses BIGINT NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  hit_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  avg_response_time DECIMAL(10, 2) NOT NULL DEFAULT 0,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create query performance table
CREATE TABLE query_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  execution_time INTEGER NOT NULL, -- milliseconds
  row_count INTEGER,
  index_usage JSONB DEFAULT '[]',
  optimization_suggestions JSONB DEFAULT '[]',
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_performance_metrics_name_timestamp ON performance_metrics(name, timestamp);
CREATE INDEX idx_performance_metrics_organization ON performance_metrics(organization_id, timestamp);
CREATE INDEX idx_performance_alerts_severity ON performance_alerts(severity, resolved);
CREATE INDEX idx_performance_alerts_organization ON performance_alerts(organization_id, timestamp);
CREATE INDEX idx_cache_stats_namespace ON cache_stats(namespace, timestamp);
CREATE INDEX idx_query_performance_hash ON query_performance(query_hash, timestamp);
CREATE INDEX idx_query_performance_organization ON query_performance(organization_id, timestamp);

-- Create RLS policies
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_performance ENABLE ROW LEVEL SECURITY;

-- Performance metrics policies
CREATE POLICY "Users can view their organization's performance metrics" ON performance_metrics
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (true);

-- Performance alerts policies
CREATE POLICY "Users can view their organization's performance alerts" ON performance_alerts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's performance alerts" ON performance_alerts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert performance alerts" ON performance_alerts
  FOR INSERT WITH CHECK (true);

-- Cache stats policies
CREATE POLICY "Users can view their organization's cache stats" ON cache_stats
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert cache stats" ON cache_stats
  FOR INSERT WITH CHECK (true);

-- Query performance policies
CREATE POLICY "Users can view their organization's query performance" ON query_performance
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert query performance" ON query_performance
  FOR INSERT WITH CHECK (true);

-- Create functions for performance monitoring

-- Function to get performance summary
CREATE OR REPLACE FUNCTION get_performance_summary(
  org_id UUID,
  hours_back INTEGER DEFAULT 24
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'avg_response_time', COALESCE(avg(value), 0),
    'error_rate', COALESCE(
      (COUNT(*) FILTER (WHERE name = 'api.error_rate') * 100.0 / COUNT(*)), 0
    ),
    'active_alerts', (
      SELECT COUNT(*) FROM performance_alerts 
      WHERE organization_id = org_id AND resolved = FALSE
    ),
    'uptime', 99.9 -- Simplified calculation
  ) INTO result
  FROM performance_metrics
  WHERE organization_id = org_id
    AND timestamp >= NOW() - INTERVAL '1 hour' * hours_back;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get slow queries
CREATE OR REPLACE FUNCTION get_slow_queries(
  org_id UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  query_hash TEXT,
  query_text TEXT,
  avg_execution_time DECIMAL(10, 2),
  execution_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qp.query_hash,
    qp.query_text,
    AVG(qp.execution_time)::DECIMAL(10, 2) as avg_execution_time,
    COUNT(*) as execution_count
  FROM query_performance qp
  WHERE qp.organization_id = org_id
    AND qp.execution_time > 1000 -- Queries taking more than 1 second
  GROUP BY qp.query_hash, qp.query_text
  ORDER BY avg_execution_time DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old performance data
CREATE OR REPLACE FUNCTION cleanup_old_performance_data(
  days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old performance metrics
  DELETE FROM performance_metrics 
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete old query performance data
  DELETE FROM query_performance 
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  -- Delete old cache stats
  DELETE FROM cache_stats 
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updated_at
CREATE TRIGGER update_performance_alerts_updated_at
  BEFORE UPDATE ON performance_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a cron job to clean up old data (runs daily) - commented out, requires pg_cron
-- SELECT cron.schedule(
--   'cleanup-performance-data',
--   '0 2 * * *', -- Daily at 2 AM
--   'SELECT cleanup_old_performance_data(30);'
-- ); 