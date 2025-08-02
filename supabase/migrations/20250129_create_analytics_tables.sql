-- Create analytics tables for advanced analytics features

-- Predictive analytics results
CREATE TABLE IF NOT EXISTS predictive_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('demand_forecast', 'price_optimization', 'churn_prediction', 'seasonality')),
  entity_id UUID NOT NULL, -- product_id or customer_id
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'customer')),
  results JSONB NOT NULL,
  confidence_score DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Anomaly detection results
CREATE TABLE IF NOT EXISTS anomaly_detection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('price', 'demand', 'inventory', 'revenue')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  description TEXT NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confidence_score DECIMAL(5,2),
  data JSONB, -- Additional anomaly data
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

-- Business insights
CREATE TABLE IF NOT EXISTS business_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('product_performance', 'customer_segment', 'market_trend', 'recommendation')),
  title TEXT NOT NULL,
  description TEXT,
  impact_level TEXT CHECK (impact_level IN ('high', 'medium', 'low')),
  priority_score INTEGER CHECK (priority_score >= 1 AND priority_score <= 10),
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Analytics metrics cache
CREATE TABLE IF NOT EXISTS analytics_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(15,2),
  metric_unit TEXT,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);

-- Analytics jobs for background processing
CREATE TABLE IF NOT EXISTS analytics_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('demand_forecast', 'price_optimization', 'churn_analysis', 'anomaly_detection')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  parameters JSONB,
  results JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predictive_analytics_org_type ON predictive_analytics(organization_id, analysis_type);
CREATE INDEX IF NOT EXISTS idx_predictive_analytics_entity ON predictive_analytics(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_predictive_analytics_created ON predictive_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_anomaly_detection_org_type ON anomaly_detection(organization_id, anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_severity ON anomaly_detection(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_detected ON anomaly_detection(detected_at);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_resolved ON anomaly_detection(resolved_at);

CREATE INDEX IF NOT EXISTS idx_business_insights_org_type ON business_insights(organization_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_business_insights_active ON business_insights(is_active);
CREATE INDEX IF NOT EXISTS idx_business_insights_priority ON business_insights(priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_metrics_cache_org_metric ON analytics_metrics_cache(organization_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_cache_expires ON analytics_metrics_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_analytics_jobs_org_status ON analytics_jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_analytics_jobs_type ON analytics_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_analytics_jobs_created ON analytics_jobs(created_at);

-- Enable RLS
ALTER TABLE predictive_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_detection ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's predictive analytics" ON predictive_analytics
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can insert their organization's predictive analytics" ON predictive_analytics
  FOR INSERT WITH CHECK (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can update their organization's predictive analytics" ON predictive_analytics
  FOR UPDATE USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can view their organization's anomaly detection" ON anomaly_detection
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can insert their organization's anomaly detection" ON anomaly_detection
  FOR INSERT WITH CHECK (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can update their organization's anomaly detection" ON anomaly_detection
  FOR UPDATE USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can view their organization's business insights" ON business_insights
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can insert their organization's business insights" ON business_insights
  FOR INSERT WITH CHECK (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can update their organization's business insights" ON business_insights
  FOR UPDATE USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can view their organization's analytics metrics cache" ON analytics_metrics_cache
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can insert their organization's analytics metrics cache" ON analytics_metrics_cache
  FOR INSERT WITH CHECK (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can update their organization's analytics metrics cache" ON analytics_metrics_cache
  FOR UPDATE USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can view their organization's analytics jobs" ON analytics_jobs
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can insert their organization's analytics jobs" ON analytics_jobs
  FOR INSERT WITH CHECK (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Users can update their organization's analytics jobs" ON analytics_jobs
  FOR UPDATE USING (organization_id = auth.jwt() ->> 'organization_id'::text);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_predictive_analytics_updated_at
  BEFORE UPDATE ON predictive_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_jobs_updated_at
  BEFORE UPDATE ON analytics_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Functions for analytics
CREATE OR REPLACE FUNCTION get_predictive_metrics(org_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Get organization ID from context if not provided
  IF org_id IS NULL THEN
    org_id := (auth.jwt() ->> 'organization_id')::UUID;
  END IF;

  -- Calculate predictive metrics
  WITH metrics AS (
    SELECT 
      AVG(CASE WHEN analysis_type = 'demand_forecast' THEN (results->>'predictedDemand')::DECIMAL ELSE 0 END) as demand_forecast,
      AVG(CASE WHEN analysis_type = 'price_optimization' THEN (results->>'revenueImpact')::DECIMAL ELSE 0 END) as price_optimization,
      COUNT(CASE WHEN analysis_type = 'churn_prediction' AND (results->>'churnRisk')::DECIMAL > 15 THEN 1 END) * 100.0 / COUNT(*) as churn_risk,
      AVG(CASE WHEN analysis_type = 'seasonality' THEN (results->>'seasonalityScore')::DECIMAL ELSE 0 END) as seasonality_score
    FROM predictive_analytics 
    WHERE organization_id = org_id 
    AND created_at > NOW() - INTERVAL '7 days'
  )
  SELECT json_build_object(
    'demandForecast', COALESCE(demand_forecast, 0),
    'stockoutRisk', 15.5, -- Mock value
    'revenuePrediction', COALESCE(price_optimization, 0),
    'customerChurnRisk', COALESCE(churn_risk, 0),
    'priceOptimization', COALESCE(price_optimization, 0),
    'seasonalityScore', COALESCE(seasonality_score, 0)
  ) INTO result FROM metrics;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_business_insights(org_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Get organization ID from context if not provided
  IF org_id IS NULL THEN
    org_id := (auth.jwt() ->> 'organization_id')::UUID;
  END IF;

  -- Get business insights
  SELECT json_build_object(
    'topPerformingProducts', (
      SELECT json_agg(json_build_object(
        'id', p.id,
        'name', p.name,
        'revenue', COALESCE(SUM(oi.quantity * oi.unit_price), 0),
        'growth', 15.5
      ))
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.organization_id = org_id
      GROUP BY p.id, p.name
      ORDER BY COALESCE(SUM(oi.quantity * oi.unit_price), 0) DESC
      LIMIT 5
    ),
    'customerSegments', (
      SELECT json_agg(json_build_object(
        'segment', COALESCE(c.segment, 'General'),
        'count', COUNT(*),
        'revenue', COALESCE(SUM(o.total_amount), 0),
        'growth', 8.2
      ))
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      WHERE c.organization_id = org_id
      GROUP BY c.segment
    ),
    'marketTrends', json_build_array(
      json_build_object('trend', 'Increasing demand for premium products', 'impact', 'positive', 'confidence', 85),
      json_build_object('trend', 'Seasonal price fluctuations', 'impact', 'neutral', 'confidence', 72),
      json_build_object('trend', 'Competitive pricing pressure', 'impact', 'negative', 'confidence', 68)
    ),
    'recommendations', (
      SELECT json_agg(json_build_object(
        'type', bi.insight_type,
        'title', bi.title,
        'description', bi.description,
        'impact', bi.impact_level,
        'priority', bi.priority_score
      ))
      FROM business_insights bi
      WHERE bi.organization_id = org_id AND bi.is_active = true
      ORDER BY bi.priority_score DESC
      LIMIT 5
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_anomaly_detection(org_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Get organization ID from context if not provided
  IF org_id IS NULL THEN
    org_id := (auth.jwt() ->> 'organization_id')::UUID;
  END IF;

  -- Get anomaly detection results
  SELECT json_build_object(
    'anomalies', (
      SELECT json_agg(json_build_object(
        'id', ad.id,
        'type', ad.anomaly_type,
        'severity', ad.severity,
        'description', ad.description,
        'detectedAt', ad.detected_at,
        'confidence', ad.confidence_score,
        'data', ad.data
      ))
      FROM anomaly_detection ad
      WHERE ad.organization_id = org_id 
      AND ad.resolved_at IS NULL
      ORDER BY ad.detected_at DESC
      LIMIT 10
    ),
    'patterns', json_build_array(
      json_build_object('pattern', 'Weekly demand cycles', 'frequency', 7, 'trend', 'stable'),
      json_build_object('pattern', 'Monthly revenue fluctuations', 'frequency', 30, 'trend', 'increasing')
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function for old analytics data
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
BEGIN
  -- Clean up old predictive analytics (keep 90 days)
  DELETE FROM predictive_analytics 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Clean up old anomaly detection (keep 60 days)
  DELETE FROM anomaly_detection 
  WHERE detected_at < NOW() - INTERVAL '60 days'
  AND resolved_at IS NOT NULL;
  
  -- Clean up old business insights (keep 30 days)
  DELETE FROM business_insights 
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND is_active = false;
  
  -- Clean up expired metrics cache
  DELETE FROM analytics_metrics_cache 
  WHERE expires_at < NOW();
  
  -- Clean up completed analytics jobs (keep 30 days)
  DELETE FROM analytics_jobs 
  WHERE completed_at < NOW() - INTERVAL '30 days'
  AND status IN ('completed', 'failed');
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job
SELECT cron.schedule(
  'cleanup-analytics-data',
  '0 2 * * *', -- Daily at 2 AM
  'SELECT cleanup_old_analytics_data();'
); 