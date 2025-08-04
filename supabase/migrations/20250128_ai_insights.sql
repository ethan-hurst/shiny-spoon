-- PRP-021: AI-Powered Insights - Database Schema

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

-- Indexes
CREATE INDEX idx_ai_predictions_lookup ON ai_predictions(organization_id, entity_type, entity_id, prediction_type);
CREATE INDEX idx_ai_predictions_date ON ai_predictions(prediction_date DESC);
CREATE INDEX idx_ai_insights_org_date ON ai_insights(organization_id, created_at DESC);
CREATE INDEX idx_ai_insights_unread ON ai_insights(organization_id, is_read) WHERE is_read = FALSE;

-- RLS
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_training_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI predictions" ON ai_predictions
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own AI insights" ON ai_insights
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own AI insights" ON ai_insights
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Insert sample AI insights for demonstration
INSERT INTO ai_insights (organization_id, insight_type, title, content, severity, related_entities, recommended_actions) VALUES
('00000000-0000-0000-0000-000000000000', 'summary', 'Weekly Business Summary', 'Your inventory accuracy improved by 2.3% this week. Low stock alerts decreased by 15%. Consider reviewing pricing strategy for top 5 products.', 'info', '[{"type": "product", "id": "123", "name": "Product A"}]', '["Review pricing for top products", "Check inventory levels"]'),
('00000000-0000-0000-0000-000000000000', 'recommendation', 'Reorder Point Optimization', 'Product "Widget X" has high demand variability. Consider increasing safety stock by 20% to prevent stockouts.', 'info', '[{"type": "product", "id": "456", "name": "Widget X"}]', '["Increase safety stock", "Monitor demand patterns"]'),
('00000000-0000-0000-0000-000000000000', 'alert', 'Unusual Order Pattern', 'Large order detected for $50,000. This is 3x higher than average order value. Verify customer credit and inventory availability.', 'warning', '[{"type": "order", "id": "789", "name": "Order #12345"}]', '["Verify customer credit", "Check inventory availability", "Review order details"]'),
('00000000-0000-0000-0000-000000000000', 'trend', 'Demand Forecasting', 'Seasonal demand increase expected for next quarter. Prepare inventory for 25% higher demand than current levels.', 'info', '[]', '["Increase inventory levels", "Plan for seasonal demand", "Review supplier capacity"]');

-- Insert sample AI predictions
INSERT INTO ai_predictions (organization_id, prediction_type, entity_type, entity_id, prediction_date, prediction_value, confidence_score, model_version, prediction_start, prediction_end) VALUES
('00000000-0000-0000-0000-000000000000', 'demand', 'product', '123', '2025-01-28', '{"forecast": [100, 120, 140, 160], "confidence": 0.85}', 0.85, '1.0.0', '2025-01-28', '2025-02-28'),
('00000000-0000-0000-0000-000000000000', 'reorder', 'product', '456', '2025-01-28', '{"reorder_point": 50, "safety_stock": 20, "lead_time": 7}', 0.92, '1.0.0', '2025-01-28', '2025-02-28'),
('00000000-0000-0000-0000-000000000000', 'price', 'product', '789', '2025-01-28', '{"current_price": 100, "suggested_price": 110, "elasticity": -1.2}', 0.78, '1.0.0', '2025-01-28', '2025-02-28'); 