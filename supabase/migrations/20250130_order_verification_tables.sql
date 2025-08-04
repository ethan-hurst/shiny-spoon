-- Create order verification tables
-- These tables track and verify that TruthSource actually fixes B2B orders

-- Order verifications table
CREATE TABLE IF NOT EXISTS order_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('pricing', 'inventory', 'customer', 'shipping', 'complete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'error')),
  erp_data JSONB NOT NULL DEFAULT '{}',
  ecommerce_data JSONB NOT NULL DEFAULT '{}',
  differences JSONB NOT NULL DEFAULT '[]',
  verified_at TIMESTAMP WITH TIME ZONE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix verifications table
CREATE TABLE IF NOT EXISTS fix_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  error_id UUID NOT NULL REFERENCES order_errors(id) ON DELETE CASCADE,
  fix_applied BOOLEAN NOT NULL DEFAULT false,
  fix_type TEXT NOT NULL CHECK (fix_type IN ('automatic', 'manual', 'ai_assisted')),
  fix_details JSONB NOT NULL DEFAULT '{}',
  verification_result TEXT NOT NULL CHECK (verification_result IN ('success', 'partial', 'failed')),
  before_state JSONB NOT NULL DEFAULT '{}',
  after_state JSONB NOT NULL DEFAULT '{}',
  fix_duration_ms INTEGER NOT NULL DEFAULT 0,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_verifications_order_id ON order_verifications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_verifications_status ON order_verifications(status);
CREATE INDEX IF NOT EXISTS idx_order_verifications_created_at ON order_verifications(created_at);
CREATE INDEX IF NOT EXISTS idx_order_verifications_org_id ON order_verifications(organization_id);

CREATE INDEX IF NOT EXISTS idx_fix_verifications_order_id ON fix_verifications(order_id);
CREATE INDEX IF NOT EXISTS idx_fix_verifications_error_id ON fix_verifications(error_id);
CREATE INDEX IF NOT EXISTS idx_fix_verifications_result ON fix_verifications(verification_result);
CREATE INDEX IF NOT EXISTS idx_fix_verifications_created_at ON fix_verifications(created_at);
CREATE INDEX IF NOT EXISTS idx_fix_verifications_org_id ON fix_verifications(organization_id);

-- Enable RLS
ALTER TABLE order_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_verifications
CREATE POLICY "Users can view order verifications for their organization" ON order_verifications
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert order verifications for their organization" ON order_verifications
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update order verifications for their organization" ON order_verifications
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for fix_verifications
CREATE POLICY "Users can view fix verifications for their organization" ON fix_verifications
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert fix verifications for their organization" ON fix_verifications
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update fix verifications for their organization" ON fix_verifications
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for order_verifications
CREATE TRIGGER update_order_verifications_updated_at 
  BEFORE UPDATE ON order_verifications 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create verification records
CREATE OR REPLACE FUNCTION create_order_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Create verification record when order error is detected
  INSERT INTO order_verifications (
    order_id,
    verification_type,
    status,
    organization_id
  ) VALUES (
    NEW.order_id,
    NEW.error_type,
    'pending',
    (SELECT organization_id FROM orders WHERE id = NEW.order_id)
  );
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically create verification records
CREATE TRIGGER trigger_create_order_verification
  AFTER INSERT ON order_errors
  FOR EACH ROW EXECUTE FUNCTION create_order_verification();

-- Create function to update verification status when error is fixed
CREATE OR REPLACE FUNCTION update_verification_on_fix()
RETURNS TRIGGER AS $$
BEGIN
  -- Update verification status when error is fixed
  UPDATE order_verifications 
  SET status = 'verified', verified_at = NOW()
  WHERE order_id = NEW.order_id 
    AND verification_type = NEW.error_type
    AND status = 'pending';
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update verification when error is fixed
CREATE TRIGGER trigger_update_verification_on_fix
  AFTER UPDATE OF fixed ON order_errors
  FOR EACH ROW 
  WHEN (NEW.fixed = true AND OLD.fixed = false)
  EXECUTE FUNCTION update_verification_on_fix();

-- Create view for verification metrics
CREATE OR REPLACE VIEW verification_metrics AS
SELECT 
  organization_id,
  DATE(created_at) as verification_date,
  COUNT(*) as total_verifications,
  COUNT(CASE WHEN status = 'verified' THEN 1 END) as successful_verifications,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_verifications,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_verifications,
  ROUND(
    (COUNT(CASE WHEN status = 'verified' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2
  ) as success_rate
FROM order_verifications
GROUP BY organization_id, DATE(created_at)
ORDER BY organization_id, verification_date DESC;

-- Create view for fix verification metrics
CREATE OR REPLACE VIEW fix_verification_metrics AS
SELECT 
  organization_id,
  DATE(created_at) as fix_date,
  COUNT(*) as total_fixes,
  COUNT(CASE WHEN verification_result = 'success' THEN 1 END) as successful_fixes,
  COUNT(CASE WHEN verification_result = 'partial' THEN 1 END) as partial_fixes,
  COUNT(CASE WHEN verification_result = 'failed' THEN 1 END) as failed_fixes,
  AVG(fix_duration_ms) as avg_fix_duration_ms,
  ROUND(
    (COUNT(CASE WHEN verification_result = 'success' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2
  ) as success_rate
FROM fix_verifications
GROUP BY organization_id, DATE(created_at)
ORDER BY organization_id, fix_date DESC; 