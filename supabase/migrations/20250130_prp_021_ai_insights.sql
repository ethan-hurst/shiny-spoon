-- AI-Powered Insights Schema (PRP-021)

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

-- Function to clean up expired predictions
CREATE OR REPLACE FUNCTION cleanup_expired_predictions()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_predictions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Scheduled cleanup (would be called by a cron job)
-- In production, set up a pg_cron job or external scheduler