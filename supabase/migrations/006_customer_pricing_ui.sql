-- PRP-011: Customer-Specific Pricing UI Extensions
-- Extends the customer_pricing table from PRP-010 with approval workflow and tracking

-- Extend customer_pricing table with approval fields
ALTER TABLE customer_pricing ADD COLUMN IF NOT EXISTS
  approval_status TEXT DEFAULT 'approved' CHECK (
    approval_status IN ('draft', 'pending', 'approved', 'rejected')
  ),
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_requested_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  
  -- Version tracking
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_price DECIMAL(10,2),
  
  -- Bulk update tracking
  ADD COLUMN IF NOT EXISTS bulk_update_id UUID,
  ADD COLUMN IF NOT EXISTS import_notes TEXT;

-- Price change history
CREATE TABLE IF NOT EXISTS customer_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_pricing_id UUID REFERENCES customer_pricing(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Price details
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  old_discount_percent DECIMAL(5,2),
  new_discount_percent DECIMAL(5,2),
  
  -- Change details
  change_type TEXT CHECK (change_type IN ('manual', 'bulk', 'contract', 'tier_change')),
  change_reason TEXT,
  
  -- Approval tracking
  requires_approval BOOLEAN DEFAULT false,
  approval_status TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Pricing contracts
CREATE TABLE IF NOT EXISTS customer_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Contract details
  contract_number TEXT UNIQUE NOT NULL,
  contract_name TEXT NOT NULL,
  description TEXT,
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  signed_date DATE,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (
    status IN ('draft', 'active', 'expired', 'cancelled')
  ),
  auto_renew BOOLEAN DEFAULT false,
  renewal_period_months INTEGER,
  
  -- Notifications
  expiry_notification_days INTEGER DEFAULT 30,
  notified_30_days BOOLEAN DEFAULT false,
  notified_7_days BOOLEAN DEFAULT false,
  
  -- Files
  document_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Contract items (products with specific pricing)
CREATE TABLE IF NOT EXISTS contract_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES customer_contracts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- Pricing
  contract_price DECIMAL(10,2),
  min_quantity INTEGER DEFAULT 0,
  max_quantity INTEGER,
  
  -- Terms
  price_locked BOOLEAN DEFAULT true,
  notes TEXT
);

-- Approval rules
CREATE TABLE IF NOT EXISTS pricing_approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Rule conditions
  discount_threshold_percent DECIMAL(5,2),
  price_reduction_threshold DECIMAL(10,2),
  margin_threshold_percent DECIMAL(5,2),
  
  -- Approval requirements
  requires_manager_approval BOOLEAN DEFAULT true,
  requires_finance_approval BOOLEAN DEFAULT false,
  auto_approve_under_threshold BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price approval queue
CREATE TABLE IF NOT EXISTS price_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  customer_pricing_id UUID REFERENCES customer_pricing(id),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  
  -- Price change details
  current_price DECIMAL(10,2),
  requested_price DECIMAL(10,2),
  discount_percent DECIMAL(5,2),
  margin_percent DECIMAL(5,2),
  
  -- Request details
  change_reason TEXT NOT NULL,
  requested_by UUID REFERENCES auth.users(id) NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Approval details
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'cancelled')
  ),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Escalation
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMPTZ,
  escalated_to UUID REFERENCES auth.users(id),
  
  -- Metadata
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_pricing_status ON customer_pricing(approval_status)
  WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_price_history_customer ON customer_price_history(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON customer_price_history(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_expiry ON customer_contracts(end_date, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON customer_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_notifications ON customer_contracts(end_date)
  WHERE status = 'active' AND (notified_30_days = false OR notified_7_days = false);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON price_approvals(organization_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approvals_expiry ON price_approvals(expires_at)
  WHERE status = 'pending';

-- RLS Policies
ALTER TABLE customer_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_approvals ENABLE ROW LEVEL SECURITY;

-- Customer Price History policies
CREATE POLICY "Users can view own organization price history" ON customer_price_history
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create price history" ON customer_price_history
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Customer Contracts policies
CREATE POLICY "Users can view own organization contracts" ON customer_contracts
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create contracts" ON customer_contracts
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization contracts" ON customer_contracts
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own organization contracts" ON customer_contracts
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Contract Items policies (inherit from contracts)
CREATE POLICY "Users can view contract items" ON contract_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customer_contracts 
      WHERE customer_contracts.id = contract_items.contract_id
        AND customer_contracts.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create contract items" ON contract_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM customer_contracts 
      WHERE customer_contracts.id = contract_items.contract_id
        AND customer_contracts.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update contract items" ON contract_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM customer_contracts 
      WHERE customer_contracts.id = contract_items.contract_id
        AND customer_contracts.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete contract items" ON contract_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM customer_contracts 
      WHERE customer_contracts.id = contract_items.contract_id
        AND customer_contracts.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

-- Pricing Approval Rules policies
CREATE POLICY "Users can view own organization approval rules" ON pricing_approval_rules
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create approval rules" ON pricing_approval_rules
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization approval rules" ON pricing_approval_rules
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Price Approvals policies
CREATE POLICY "Users can view own organization approvals" ON price_approvals
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create approvals" ON price_approvals
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization approvals" ON price_approvals
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Function to check if price change needs approval
CREATE OR REPLACE FUNCTION check_price_approval_required(
  p_customer_id UUID,
  p_product_id UUID,
  p_new_price DECIMAL(10,2),
  p_organization_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_base_price DECIMAL(10,2);
  v_cost DECIMAL(10,2);
  v_discount_percent DECIMAL(5,2);
  v_margin_percent DECIMAL(5,2);
  v_rules RECORD;
BEGIN
  -- Get base price and cost
  SELECT pp.base_price, pp.cost INTO v_base_price, v_cost
  FROM product_pricing pp
  WHERE pp.product_id = p_product_id
    AND pp.organization_id = p_organization_id
  ORDER BY pp.effective_date DESC
  LIMIT 1;
  
  -- Calculate discount and margin
  v_discount_percent := ((v_base_price - p_new_price) / v_base_price) * 100;
  v_margin_percent := ((p_new_price - v_cost) / p_new_price) * 100;
  
  -- Get approval rules
  SELECT * INTO v_rules
  FROM pricing_approval_rules
  WHERE organization_id = p_organization_id
  LIMIT 1;
  
  -- Check if approval needed
  IF v_rules IS NOT NULL THEN
    IF v_discount_percent >= COALESCE(v_rules.discount_threshold_percent, 20) OR
       v_margin_percent <= COALESCE(v_rules.margin_threshold_percent, 15) THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to log price changes
CREATE OR REPLACE FUNCTION log_customer_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if price actually changed
  IF (OLD.override_price IS DISTINCT FROM NEW.override_price) OR 
     (OLD.override_discount_percent IS DISTINCT FROM NEW.override_discount_percent) THEN
    
    INSERT INTO customer_price_history (
      customer_pricing_id,
      customer_id,
      product_id,
      organization_id,
      old_price,
      new_price,
      old_discount_percent,
      new_discount_percent,
      change_type,
      change_reason,
      created_by
    ) VALUES (
      NEW.id,
      NEW.customer_id,
      NEW.product_id,
      NEW.organization_id,
      OLD.override_price,
      NEW.override_price,
      OLD.override_discount_percent,
      NEW.override_discount_percent,
      CASE 
        WHEN NEW.bulk_update_id IS NOT NULL THEN 'bulk'
        WHEN NEW.contract_number IS NOT NULL THEN 'contract'
        ELSE 'manual'
      END,
      NEW.notes,
      NEW.updated_by
    );
  END IF;
  
  -- Update version
  NEW.version = OLD.version + 1;
  NEW.previous_price = OLD.override_price;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for price change logging
CREATE TRIGGER log_customer_price_changes
  BEFORE UPDATE ON customer_pricing
  FOR EACH ROW
  EXECUTE FUNCTION log_customer_price_change();

-- Function to update contract status
CREATE OR REPLACE FUNCTION update_contract_status()
RETURNS void AS $$
BEGIN
  -- Expire contracts that have passed end date
  UPDATE customer_contracts
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
    AND end_date < CURRENT_DATE;
  
  -- Activate contracts that have reached start date
  UPDATE customer_contracts
  SET status = 'active',
      updated_at = NOW()
  WHERE status = 'draft'
    AND start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE
    AND signed_date IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to update contract status (run daily)
-- Note: This would be implemented as a Supabase Edge Function or external cron job

-- Function to get customer product price with all rules applied
CREATE OR REPLACE FUNCTION get_customer_product_price(
  p_customer_id UUID,
  p_product_id UUID,
  p_quantity INTEGER DEFAULT 1
) RETURNS TABLE (
  base_price DECIMAL(10,2),
  customer_price DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  discount_percent DECIMAL(5,2),
  price_source TEXT,
  contract_id UUID,
  approval_status TEXT
) AS $$
DECLARE
  v_customer_pricing RECORD;
  v_contract_price RECORD;
  v_calculated_price RECORD;
BEGIN
  -- Check for direct customer pricing override
  SELECT cp.*, cc.id as contract_id
  INTO v_customer_pricing
  FROM customer_pricing cp
  LEFT JOIN customer_contracts cc ON cc.contract_number = cp.contract_number
    AND cc.customer_id = cp.customer_id
    AND cc.status = 'active'
  WHERE cp.customer_id = p_customer_id
    AND cp.product_id = p_product_id
    AND cp.approval_status = 'approved';
  
  -- Check for active contract pricing
  IF v_customer_pricing.id IS NULL THEN
    SELECT ci.contract_price, cc.id as contract_id
    INTO v_contract_price
    FROM contract_items ci
    JOIN customer_contracts cc ON cc.id = ci.contract_id
    WHERE cc.customer_id = p_customer_id
      AND ci.product_id = p_product_id
      AND cc.status = 'active'
      AND (ci.min_quantity IS NULL OR ci.min_quantity <= p_quantity)
      AND (ci.max_quantity IS NULL OR ci.max_quantity >= p_quantity)
    ORDER BY cc.start_date DESC
    LIMIT 1;
  END IF;
  
  -- Get calculated price from pricing engine
  SELECT * INTO v_calculated_price
  FROM calculate_product_price(p_product_id, p_customer_id, p_quantity);
  
  -- Return the appropriate price
  IF v_customer_pricing.id IS NOT NULL THEN
    -- Use customer-specific override
    RETURN QUERY
    SELECT 
      v_calculated_price.base_price,
      COALESCE(v_customer_pricing.override_price, 
               v_calculated_price.base_price * (1 - v_customer_pricing.override_discount_percent / 100)),
      v_calculated_price.base_price - COALESCE(v_customer_pricing.override_price, 
               v_calculated_price.base_price * (1 - v_customer_pricing.override_discount_percent / 100)),
      CASE 
        WHEN v_customer_pricing.override_price IS NOT NULL THEN
          ((v_calculated_price.base_price - v_customer_pricing.override_price) / v_calculated_price.base_price) * 100
        ELSE
          v_customer_pricing.override_discount_percent
      END,
      CASE
        WHEN v_customer_pricing.contract_id IS NOT NULL THEN 'contract'
        ELSE 'customer_override'
      END,
      v_customer_pricing.contract_id,
      v_customer_pricing.approval_status;
      
  ELSIF v_contract_price.contract_price IS NOT NULL THEN
    -- Use contract pricing
    RETURN QUERY
    SELECT 
      v_calculated_price.base_price,
      v_contract_price.contract_price,
      v_calculated_price.base_price - v_contract_price.contract_price,
      ((v_calculated_price.base_price - v_contract_price.contract_price) / v_calculated_price.base_price) * 100,
      'contract',
      v_contract_price.contract_id,
      'approved';
      
  ELSE
    -- Use calculated price
    RETURN QUERY
    SELECT 
      v_calculated_price.base_price,
      v_calculated_price.final_price,
      v_calculated_price.discount_amount,
      v_calculated_price.discount_percent,
      'calculated',
      NULL::UUID,
      'approved';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer pricing statistics
CREATE OR REPLACE FUNCTION get_customer_pricing_stats(
  p_customer_id UUID
) RETURNS TABLE (
  total_products BIGINT,
  custom_prices BIGINT,
  contract_prices BIGINT,
  average_discount DECIMAL(5,2),
  pending_approvals BIGINT,
  expiring_contracts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH product_count AS (
    SELECT COUNT(DISTINCT p.id) as total
    FROM products p
    WHERE p.organization_id = (
      SELECT organization_id FROM customers WHERE id = p_customer_id
    )
  ),
  custom_price_count AS (
    SELECT COUNT(DISTINCT cp.product_id) as custom_count
    FROM customer_pricing cp
    WHERE cp.customer_id = p_customer_id
      AND cp.approval_status = 'approved'
      AND (cp.override_price IS NOT NULL OR cp.override_discount_percent IS NOT NULL)
  ),
  contract_price_count AS (
    SELECT COUNT(DISTINCT ci.product_id) as contract_count
    FROM contract_items ci
    JOIN customer_contracts cc ON cc.id = ci.contract_id
    WHERE cc.customer_id = p_customer_id
      AND cc.status = 'active'
  ),
  avg_discount AS (
    SELECT AVG(
      CASE 
        WHEN cp.override_discount_percent IS NOT NULL THEN cp.override_discount_percent
        WHEN cp.override_price IS NOT NULL AND pp.base_price > 0 THEN 
          ((pp.base_price - cp.override_price) / pp.base_price) * 100
        ELSE 0
      END
    ) as discount
    FROM customer_pricing cp
    JOIN product_pricing pp ON pp.product_id = cp.product_id
    WHERE cp.customer_id = p_customer_id
      AND cp.approval_status = 'approved'
  )
  SELECT 
    pc.total,
    cpc.custom_count,
    ccpc.contract_count,
    COALESCE(ad.discount, 0),
    0::BIGINT, -- Pending approvals will be counted separately
    0::BIGINT  -- Expiring contracts will be counted separately
  FROM product_count pc,
       custom_price_count cpc,
       contract_price_count ccpc,
       avg_discount ad;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;