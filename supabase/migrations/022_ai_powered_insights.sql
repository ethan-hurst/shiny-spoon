-- PRP-021: AI-Powered Insights Database Schema
-- This migration creates the infrastructure for AI insights and predictions

-- AI predictions storage
CREATE TABLE ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('demand', 'reorder', 'price', 'anomaly')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'warehouse', 'category')),
  entity_id UUID NOT NULL,

  -- Prediction details
  prediction_date DATE NOT NULL,
  prediction_value JSONB NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Model metadata
  model_version TEXT NOT NULL,
  model_parameters JSONB DEFAULT '{}',

  -- Time range
  prediction_start DATE NOT NULL,
  prediction_end DATE NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- For cache management

  UNIQUE(organization_id, prediction_type, entity_type, entity_id, prediction_date)
);

-- AI insights log
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('summary', 'recommendation', 'alert', 'trend')),

  -- Insight content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),

  -- Related data
  related_entities JSONB DEFAULT '[]', -- Array of {type, id, name}
  metrics JSONB DEFAULT '{}',

  -- Actions
  recommended_actions JSONB DEFAULT '[]',

  -- Tracking
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ
);

-- Training data snapshots for ML models
CREATE TABLE ml_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  model_type TEXT NOT NULL,

  -- Training data
  data JSONB NOT NULL,
  feature_names TEXT[],

  -- Model performance
  metrics JSONB DEFAULT '{}', -- MAE, RMSE, R2, etc.

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_predictions_lookup ON ai_predictions(organization_id, entity_type, entity_id, prediction_type);
CREATE INDEX idx_ai_predictions_date ON ai_predictions(prediction_date DESC);
CREATE INDEX idx_ai_insights_org_date ON ai_insights(organization_id, created_at DESC);
CREATE INDEX idx_ai_insights_unread ON ai_insights(organization_id, is_read) WHERE is_read = FALSE;

-- RLS Policies
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_training_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI predictions" ON ai_predictions
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "System can manage AI predictions" ON ai_predictions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own AI insights" ON ai_insights
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own AI insights" ON ai_insights
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "System can manage AI insights" ON ai_insights
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view training data" ON ml_training_data
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Functions for AI operations

-- Function to get historical demand data for forecasting
CREATE OR REPLACE FUNCTION get_historical_demand(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_days_back INTEGER DEFAULT 365
)
RETURNS TABLE(
  date DATE,
  quantity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(oi.created_at) as date,
    SUM(oi.quantity)::INTEGER as quantity
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.product_id = p_product_id
    AND o.warehouse_id = p_warehouse_id
    AND oi.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY DATE(oi.created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate simple moving average forecast
CREATE OR REPLACE FUNCTION calculate_moving_average_forecast(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_days_forecast INTEGER DEFAULT 30,
  p_window_size INTEGER DEFAULT 7
)
RETURNS TABLE(
  forecast_date DATE,
  predicted_quantity DECIMAL
) AS $$
DECLARE
  recent_avg DECIMAL;
BEGIN
  -- Calculate average demand over the window
  SELECT AVG(daily_quantity) INTO recent_avg
  FROM (
    SELECT SUM(oi.quantity) as daily_quantity
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = p_product_id
      AND o.warehouse_id = p_warehouse_id
      AND oi.created_at >= NOW() - (p_window_size || ' days')::INTERVAL
    GROUP BY DATE(oi.created_at)
  ) daily_data;

  -- If no data, return 0 forecast
  IF recent_avg IS NULL THEN
    recent_avg := 0;
  END IF;

  -- Generate forecast for the specified period
  RETURN QUERY
  SELECT 
    (CURRENT_DATE + i)::DATE as forecast_date,
    COALESCE(recent_avg, 0) as predicted_quantity
  FROM generate_series(1, p_days_forecast) i;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect inventory anomalies
CREATE OR REPLACE FUNCTION detect_inventory_anomalies(
  p_organization_id UUID
)
RETURNS TABLE(
  product_id UUID,
  warehouse_id UUID,
  product_name TEXT,
  warehouse_name TEXT,
  current_quantity INTEGER,
  anomaly_type TEXT,
  severity TEXT,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Out of stock items
  SELECT 
    i.product_id,
    i.warehouse_id,
    p.name as product_name,
    w.name as warehouse_name,
    i.quantity as current_quantity,
    'out_of_stock'::TEXT as anomaly_type,
    'critical'::TEXT as severity,
    'Product is completely out of stock'::TEXT as description
  FROM inventory i
  JOIN products p ON i.product_id = p.id
  JOIN warehouses w ON i.warehouse_id = w.id
  WHERE i.organization_id = p_organization_id
    AND i.quantity = 0
    AND p.is_active = true

  UNION ALL

  -- Low stock items (below reorder point)
  SELECT 
    i.product_id,
    i.warehouse_id,
    p.name as product_name,
    w.name as warehouse_name,
    i.quantity as current_quantity,
    'low_stock'::TEXT as anomaly_type,
    'warning'::TEXT as severity,
    'Inventory below reorder point'::TEXT as description
  FROM inventory i
  JOIN products p ON i.product_id = p.id
  JOIN warehouses w ON i.warehouse_id = w.id
  WHERE i.organization_id = p_organization_id
    AND i.quantity > 0
    AND i.quantity <= COALESCE(i.reorder_point, 10)
    AND p.is_active = true

  UNION ALL

  -- Excessive inventory (more than 6 months of average demand)
  SELECT 
    i.product_id,
    i.warehouse_id,
    p.name as product_name,
    w.name as warehouse_name,
    i.quantity as current_quantity,
    'excess_inventory'::TEXT as anomaly_type,
    'info'::TEXT as severity,
    'Potentially excessive inventory levels'::TEXT as description
  FROM inventory i
  JOIN products p ON i.product_id = p.id
  JOIN warehouses w ON i.warehouse_id = w.id
  LEFT JOIN (
    SELECT 
      oi.product_id,
      o.warehouse_id,
      AVG(daily_quantity) as avg_daily_demand
    FROM (
      SELECT 
        oi.product_id,
        o.warehouse_id,
        DATE(oi.created_at) as order_date,
        SUM(oi.quantity) as daily_quantity
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY oi.product_id, o.warehouse_id, DATE(oi.created_at)
    ) daily_orders
    GROUP BY product_id, warehouse_id
  ) demand ON i.product_id = demand.product_id AND i.warehouse_id = demand.warehouse_id
  WHERE i.organization_id = p_organization_id
    AND demand.avg_daily_demand > 0
    AND i.quantity > (demand.avg_daily_demand * 180) -- 6 months of inventory
    AND p.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate reorder suggestions
CREATE OR REPLACE FUNCTION generate_reorder_suggestions(
  p_organization_id UUID
)
RETURNS TABLE(
  product_id UUID,
  warehouse_id UUID,
  product_name TEXT,
  warehouse_name TEXT,
  current_quantity INTEGER,
  suggested_reorder_point INTEGER,
  suggested_order_quantity INTEGER,
  lead_time_days INTEGER,
  reasoning TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.product_id,
    i.warehouse_id,
    p.name as product_name,
    w.name as warehouse_name,
    i.quantity as current_quantity,
    -- Simple reorder point calculation: lead time demand + safety stock
    GREATEST(
      COALESCE(
        (demand_data.avg_daily_demand * COALESCE(p.lead_time_days, 7)) + 
        (demand_data.avg_daily_demand * 0.5), -- 50% safety stock
        10
      )::INTEGER,
      10
    ) as suggested_reorder_point,
    -- Economic order quantity (simplified)
    GREATEST(
      COALESCE(
        SQRT(2 * demand_data.avg_daily_demand * 365 * 50 / COALESCE(p.unit_price * 0.25, 1))::INTEGER,
        50
      ),
      50
    ) as suggested_order_quantity,
    COALESCE(p.lead_time_days, 7) as lead_time_days,
    CONCAT(
      'Based on average daily demand of ', 
      ROUND(COALESCE(demand_data.avg_daily_demand, 0), 1),
      ' units and lead time of ',
      COALESCE(p.lead_time_days, 7),
      ' days'
    ) as reasoning
  FROM inventory i
  JOIN products p ON i.product_id = p.id
  JOIN warehouses w ON i.warehouse_id = w.id
  LEFT JOIN (
    SELECT 
      oi.product_id,
      o.warehouse_id,
      AVG(daily_quantity) as avg_daily_demand
    FROM (
      SELECT 
        oi.product_id,
        o.warehouse_id,
        DATE(oi.created_at) as order_date,
        SUM(oi.quantity) as daily_quantity
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY oi.product_id, o.warehouse_id, DATE(oi.created_at)
    ) daily_orders
    GROUP BY product_id, warehouse_id
  ) demand_data ON i.product_id = demand_data.product_id AND i.warehouse_id = demand_data.warehouse_id
  WHERE i.organization_id = p_organization_id
    AND p.is_active = true
    AND (
      i.quantity <= COALESCE(i.reorder_point, 10) OR
      demand_data.avg_daily_demand > 0
    )
  ORDER BY 
    CASE WHEN i.quantity <= COALESCE(i.reorder_point, 10) THEN 1 ELSE 2 END,
    demand_data.avg_daily_demand DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to store AI insights
CREATE OR REPLACE FUNCTION store_ai_insight(
  p_organization_id UUID,
  p_insight_type TEXT,
  p_title TEXT,
  p_content TEXT,
  p_severity TEXT DEFAULT 'info',
  p_related_entities JSONB DEFAULT '[]',
  p_recommended_actions JSONB DEFAULT '[]',
  p_valid_hours INTEGER DEFAULT 168 -- 7 days
)
RETURNS UUID AS $$
DECLARE
  insight_id UUID;
BEGIN
  INSERT INTO ai_insights (
    organization_id,
    insight_type,
    title,
    content,
    severity,
    related_entities,
    recommended_actions,
    valid_until
  ) VALUES (
    p_organization_id,
    p_insight_type,
    p_title,
    p_content,
    p_severity,
    p_related_entities,
    p_recommended_actions,
    NOW() + (p_valid_hours || ' hours')::INTERVAL
  ) RETURNING id INTO insight_id;

  RETURN insight_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_historical_demand TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_moving_average_forecast TO authenticated;
GRANT EXECUTE ON FUNCTION detect_inventory_anomalies TO authenticated;
GRANT EXECUTE ON FUNCTION generate_reorder_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION store_ai_insight TO service_role;

-- Insert some sample AI insights for demo purposes
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LIMIT 5 LOOP
    PERFORM store_ai_insight(
      org_record.id,
      'recommendation',
      'Demand Forecast Update',
      'Based on recent sales patterns, we predict a 15% increase in demand for electronics category over the next 2 weeks.',
      'info',
      '[{"type": "category", "id": "electronics", "name": "Electronics"}]',
      '["Review inventory levels for electronics", "Consider increasing orders for top-selling items"]'
    );

    PERFORM store_ai_insight(
      org_record.id,
      'alert',
      'Low Stock Alert',
      'Multiple products are approaching reorder points. Immediate action recommended to avoid stockouts.',
      'warning',
      '[]',
      '["Review reorder suggestions", "Place urgent orders for critical items"]'
    );
  END LOOP;
END
$$;

-- Comments for documentation
COMMENT ON TABLE ai_predictions IS 'AI/ML predictions for demand forecasting, reorder points, and pricing';
COMMENT ON TABLE ai_insights IS 'AI-generated insights, recommendations, and alerts for business intelligence';
COMMENT ON TABLE ml_training_data IS 'Historical training data and model performance metrics';
COMMENT ON FUNCTION get_historical_demand IS 'Retrieves historical demand data for a product at a warehouse';
COMMENT ON FUNCTION calculate_moving_average_forecast IS 'Generates simple moving average forecast for demand';
COMMENT ON FUNCTION detect_inventory_anomalies IS 'Identifies inventory anomalies like stockouts and excess inventory';
COMMENT ON FUNCTION generate_reorder_suggestions IS 'Provides intelligent reorder point and quantity recommendations';