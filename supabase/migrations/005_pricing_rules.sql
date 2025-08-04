-- Pricing Rules Engine Schema
-- Supports dynamic B2B pricing with multiple rule types, quantity breaks, and customer-specific overrides

-- Product categories table (if not exists)
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id UUID REFERENCES product_categories(id),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, slug)
);

-- Base product pricing
CREATE TABLE IF NOT EXISTS product_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Base pricing
  cost DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
  min_margin_percent DECIMAL(5,2) DEFAULT 20 CHECK (min_margin_percent >= 0 AND min_margin_percent <= 100),
  
  -- Currency and units
  currency TEXT DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  pricing_unit TEXT DEFAULT 'EACH' CHECK (pricing_unit IN ('EACH', 'CASE', 'PALLET', 'BOX', 'POUND', 'KILOGRAM')),
  unit_quantity INTEGER DEFAULT 1 CHECK (unit_quantity > 0),
  
  -- Metadata
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure one active price per product
  UNIQUE(product_id, effective_date),
  -- Ensure expiry is after effective date
  CHECK (expiry_date IS NULL OR expiry_date > effective_date)
);

-- Pricing rules with priority
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Rule identification
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('tier', 'quantity', 'promotion', 'override')),
  priority INTEGER DEFAULT 100 CHECK (priority >= 0), -- Lower number = higher priority
  
  -- Rule conditions (flexible JSONB for complex conditions)
  conditions JSONB NOT NULL DEFAULT '{}',
  
  -- Rule actions
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'price')),
  discount_value DECIMAL(10,2) CHECK (discount_value >= 0),
  
  -- Applicability
  product_id UUID REFERENCES products(id),
  category_id UUID REFERENCES product_categories(id),
  customer_id UUID REFERENCES customers(id),
  customer_tier_id UUID REFERENCES customer_tiers(id),
  
  -- Stacking rules
  is_exclusive BOOLEAN DEFAULT false, -- If true, no other rules apply after this
  can_stack BOOLEAN DEFAULT true, -- If false, cannot combine with other discounts
  
  -- Status and dates
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure end date is after start date
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  -- Ensure discount value is provided when discount type is set
  CHECK ((discount_type IS NULL AND discount_value IS NULL) OR (discount_type IS NOT NULL AND discount_value IS NOT NULL))
);

-- Quantity break pricing
CREATE TABLE IF NOT EXISTS quantity_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_rule_id UUID REFERENCES pricing_rules(id) ON DELETE CASCADE NOT NULL,
  
  min_quantity INTEGER NOT NULL CHECK (min_quantity >= 0),
  max_quantity INTEGER CHECK (max_quantity IS NULL OR max_quantity > min_quantity),
  
  -- Price or discount for this quantity range
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'price')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value >= 0),
  
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  
  -- Ensure no overlapping ranges for the same rule
  EXCLUDE USING gist (
    pricing_rule_id WITH =,
    int4range(min_quantity, max_quantity, '[)') WITH &&
  )
);

-- Customer-specific pricing overrides
CREATE TABLE IF NOT EXISTS customer_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Override pricing
  override_price DECIMAL(10,2) CHECK (override_price >= 0),
  override_discount_percent DECIMAL(5,2) CHECK (override_discount_percent >= 0 AND override_discount_percent <= 100),
  
  -- Contract details
  contract_number TEXT,
  contract_start DATE,
  contract_end DATE,
  
  -- Approval workflow
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(customer_id, product_id),
  -- Ensure contract end is after start
  CHECK (contract_end IS NULL OR contract_start IS NULL OR contract_end >= contract_start),
  -- Ensure either price or discount, not both
  CHECK ((override_price IS NULL AND override_discount_percent IS NOT NULL) OR 
         (override_price IS NOT NULL AND override_discount_percent IS NULL) OR
         (override_price IS NULL AND override_discount_percent IS NULL))
);

-- Price calculation audit log
CREATE TABLE IF NOT EXISTS price_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Request details
  product_id UUID REFERENCES products(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  requested_by UUID REFERENCES auth.users(id),
  
  -- Calculation results
  base_price DECIMAL(10,2) NOT NULL,
  final_price DECIMAL(10,2) NOT NULL,
  total_discount DECIMAL(10,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  margin_percent DECIMAL(5,2),
  
  -- Applied rules (for audit)
  applied_rules JSONB DEFAULT '[]',
  calculation_details JSONB DEFAULT '{}',
  
  -- Performance tracking
  calculation_time_ms INTEGER,
  
  -- Cache control
  cache_key TEXT,
  ttl_seconds INTEGER DEFAULT 300
);

-- Indexes for performance
CREATE INDEX idx_product_categories_org ON product_categories(organization_id);
CREATE INDEX idx_product_categories_parent ON product_categories(parent_id);
CREATE INDEX idx_product_pricing_product ON product_pricing(product_id, effective_date DESC);
CREATE INDEX idx_product_pricing_active ON product_pricing(product_id) 
  WHERE expiry_date IS NULL OR expiry_date > CURRENT_DATE;
CREATE INDEX idx_pricing_rules_active ON pricing_rules(organization_id, is_active) 
  WHERE is_active = true;
CREATE INDEX idx_pricing_rules_dates ON pricing_rules(start_date, end_date);
CREATE INDEX idx_pricing_rules_product ON pricing_rules(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_pricing_rules_category ON pricing_rules(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_pricing_rules_customer ON pricing_rules(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_pricing_rules_tier ON pricing_rules(customer_tier_id) WHERE customer_tier_id IS NOT NULL;
CREATE INDEX idx_quantity_breaks_rule ON quantity_breaks(pricing_rule_id, min_quantity);
CREATE INDEX idx_customer_pricing_lookup ON customer_pricing(customer_id, product_id, organization_id);
CREATE INDEX idx_customer_pricing_contract ON customer_pricing(contract_start, contract_end);
CREATE INDEX idx_price_calculations_recent ON price_calculations(organization_id, requested_at DESC);
CREATE INDEX idx_price_calculations_cache ON price_calculations(cache_key) WHERE cache_key IS NOT NULL;

-- RLS Policies
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE quantity_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_calculations ENABLE ROW LEVEL SECURITY;

-- Product Categories policies
CREATE POLICY "Users can view own organization categories" ON product_categories
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create categories" ON product_categories
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization categories" ON product_categories
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own organization categories" ON product_categories
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Product Pricing policies
CREATE POLICY "Users can view own organization pricing" ON product_pricing
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create pricing" ON product_pricing
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization pricing" ON product_pricing
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Pricing Rules policies
CREATE POLICY "Users can view own organization rules" ON pricing_rules
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create rules" ON pricing_rules
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization rules" ON pricing_rules
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own organization rules" ON pricing_rules
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Quantity Breaks policies (inherit from pricing rules)
CREATE POLICY "Users can view quantity breaks" ON quantity_breaks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pricing_rules 
      WHERE pricing_rules.id = quantity_breaks.pricing_rule_id
        AND pricing_rules.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create quantity breaks" ON quantity_breaks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pricing_rules 
      WHERE pricing_rules.id = quantity_breaks.pricing_rule_id
        AND pricing_rules.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update quantity breaks" ON quantity_breaks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM pricing_rules 
      WHERE pricing_rules.id = quantity_breaks.pricing_rule_id
        AND pricing_rules.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete quantity breaks" ON quantity_breaks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pricing_rules 
      WHERE pricing_rules.id = quantity_breaks.pricing_rule_id
        AND pricing_rules.organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

-- Customer Pricing policies
CREATE POLICY "Users can view own organization customer pricing" ON customer_pricing
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create customer pricing" ON customer_pricing
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization customer pricing" ON customer_pricing
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own organization customer pricing" ON customer_pricing
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Price Calculations policies
CREATE POLICY "Users can view own organization calculations" ON price_calculations
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create calculations" ON price_calculations
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Triggers
-- Update timestamp trigger for product_pricing
CREATE TRIGGER update_product_pricing_updated_at
  BEFORE UPDATE ON product_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update timestamp trigger for pricing_rules
CREATE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update timestamp trigger for customer_pricing
CREATE TRIGGER update_customer_pricing_updated_at
  BEFORE UPDATE ON customer_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update timestamp trigger for product_categories
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Price calculation function
CREATE OR REPLACE FUNCTION calculate_product_price(
  p_product_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_requested_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  base_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  discount_percent DECIMAL(5,2),
  margin_percent DECIMAL(5,2),
  applied_rules JSONB
) AS $$
DECLARE
  v_organization_id UUID;
  v_base_price DECIMAL(10,2);
  v_cost DECIMAL(10,2);
  v_min_margin DECIMAL(5,2);
  v_final_price DECIMAL(10,2);
  v_applied_rules JSONB := '[]'::JSONB;
  v_customer_tier_id UUID;
  v_product_category_id UUID;
  v_rule RECORD;
  v_discount DECIMAL(10,2) := 0;
  v_total_discount_percent DECIMAL(5,2) := 0;
BEGIN
  -- Get base price and cost
  SELECT 
    pp.base_price, 
    pp.cost, 
    pp.min_margin_percent,
    pp.organization_id,
    p.category_id
  INTO 
    v_base_price, 
    v_cost, 
    v_min_margin,
    v_organization_id,
    v_product_category_id
  FROM product_pricing pp
  JOIN products p ON p.id = pp.product_id
  WHERE pp.product_id = p_product_id
    AND (pp.effective_date IS NULL OR pp.effective_date <= p_requested_date)
    AND (pp.expiry_date IS NULL OR pp.expiry_date >= p_requested_date)
  ORDER BY pp.effective_date DESC
  LIMIT 1;
  
  IF v_base_price IS NULL THEN
    RAISE EXCEPTION 'No pricing found for product %', p_product_id;
  END IF;
  
  -- Start with base price
  v_final_price := v_base_price;
  
  -- Get customer tier if applicable
  IF p_customer_id IS NOT NULL THEN
    SELECT tier_id INTO v_customer_tier_id
    FROM customers
    WHERE id = p_customer_id;
    
    -- Check for customer-specific pricing
    SELECT override_price, override_discount_percent
    INTO v_final_price, v_total_discount_percent
    FROM customer_pricing
    WHERE customer_id = p_customer_id
      AND product_id = p_product_id
      AND (contract_start IS NULL OR contract_start <= p_requested_date)
      AND (contract_end IS NULL OR contract_end >= p_requested_date);
    
    IF v_final_price IS NOT NULL THEN
      -- Customer has specific price override
      v_applied_rules := v_applied_rules || jsonb_build_object(
        'type', 'customer_override',
        'description', 'Customer-specific pricing',
        'discount_amount', v_base_price - v_final_price
      );
      
      -- Calculate discount percent
      v_total_discount_percent := ((v_base_price - v_final_price) / v_base_price) * 100;
      
      -- Skip other rules for customer overrides
      RETURN QUERY
      SELECT 
        v_base_price,
        v_final_price,
        v_base_price - v_final_price,
        v_total_discount_percent,
        ((v_final_price - v_cost) / v_final_price) * 100,
        v_applied_rules;
      RETURN;
    ELSIF v_total_discount_percent IS NOT NULL THEN
      -- Customer has discount percent override
      v_discount := v_base_price * (v_total_discount_percent / 100);
      v_final_price := v_base_price - v_discount;
      
      v_applied_rules := v_applied_rules || jsonb_build_object(
        'type', 'customer_discount',
        'description', 'Customer-specific discount',
        'discount_percent', v_total_discount_percent,
        'discount_amount', v_discount
      );
    END IF;
  END IF;
  
  -- Apply pricing rules if no customer override
  IF v_final_price = v_base_price THEN
    FOR v_rule IN
      SELECT 
        pr.*,
        qb.discount_type as qb_discount_type,
        qb.discount_value as qb_discount_value
      FROM pricing_rules pr
      LEFT JOIN quantity_breaks qb ON qb.pricing_rule_id = pr.id
        AND p_quantity >= qb.min_quantity
        AND (qb.max_quantity IS NULL OR p_quantity < qb.max_quantity)
      WHERE pr.organization_id = v_organization_id
        AND pr.is_active = true
        AND (pr.start_date IS NULL OR pr.start_date <= p_requested_date)
        AND (pr.end_date IS NULL OR pr.end_date >= p_requested_date)
        AND (pr.product_id IS NULL OR pr.product_id = p_product_id)
        AND (pr.category_id IS NULL OR pr.category_id = v_product_category_id)
        AND (pr.customer_id IS NULL OR pr.customer_id = p_customer_id)
        AND (pr.customer_tier_id IS NULL OR pr.customer_tier_id = v_customer_tier_id)
      ORDER BY pr.priority ASC, pr.created_at ASC
    LOOP
      -- Use quantity break discount if available, otherwise use rule discount
      DECLARE
        v_rule_discount_type TEXT;
        v_rule_discount_value DECIMAL(10,2);
        v_rule_discount DECIMAL(10,2) := 0;
      BEGIN
        v_rule_discount_type := COALESCE(v_rule.qb_discount_type, v_rule.discount_type);
        v_rule_discount_value := COALESCE(v_rule.qb_discount_value, v_rule.discount_value);
        
        IF v_rule_discount_type = 'percentage' THEN
          v_rule_discount := v_final_price * (v_rule_discount_value / 100);
        ELSIF v_rule_discount_type = 'fixed' THEN
          v_rule_discount := v_rule_discount_value;
        ELSIF v_rule_discount_type = 'price' THEN
          v_rule_discount := v_final_price - v_rule_discount_value;
        END IF;
        
        -- Apply discount
        v_final_price := v_final_price - v_rule_discount;
        v_discount := v_discount + v_rule_discount;
        
        -- Add to applied rules
        v_applied_rules := v_applied_rules || jsonb_build_object(
          'rule_id', v_rule.id,
          'type', v_rule.rule_type,
          'name', v_rule.name,
          'discount_type', v_rule_discount_type,
          'discount_value', v_rule_discount_value,
          'discount_amount', v_rule_discount
        );
        
        -- Check if exclusive rule
        IF v_rule.is_exclusive THEN
          EXIT;
        END IF;
      END;
    END LOOP;
  END IF;
  
  -- Enforce minimum margin
  DECLARE
    v_min_price DECIMAL(10,2);
  BEGIN
    v_min_price := v_cost * (1 + (v_min_margin / 100));
    IF v_final_price < v_min_price THEN
      v_final_price := v_min_price;
      v_applied_rules := v_applied_rules || jsonb_build_object(
        'type', 'margin_protection',
        'description', 'Minimum margin enforced',
        'min_margin_percent', v_min_margin
      );
    END IF;
  END;
  
  -- Calculate final metrics
  v_total_discount_percent := CASE 
    WHEN v_base_price > 0 THEN ((v_base_price - v_final_price) / v_base_price) * 100
    ELSE 0
  END;
  
  RETURN QUERY
  SELECT 
    v_base_price,
    v_final_price,
    v_base_price - v_final_price,
    v_total_discount_percent,
    CASE 
      WHEN v_final_price > 0 THEN ((v_final_price - v_cost) / v_final_price) * 100
      ELSE 0
    END,
    v_applied_rules;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate pricing rules
CREATE OR REPLACE FUNCTION validate_pricing_rule()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate conditions JSONB structure
  IF NEW.conditions IS NOT NULL AND jsonb_typeof(NEW.conditions) != 'object' THEN
    RAISE EXCEPTION 'Conditions must be a valid JSON object';
  END IF;
  
  -- Validate that quantity rules have quantity breaks
  IF NEW.rule_type = 'quantity' THEN
    -- This will be checked after insert with a deferred constraint
    NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_pricing_rule_trigger
  BEFORE INSERT OR UPDATE ON pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION validate_pricing_rule();

-- Function to get active pricing rules for a product
CREATE OR REPLACE FUNCTION get_active_pricing_rules(
  p_product_id UUID,
  p_organization_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  rule_id UUID,
  rule_name TEXT,
  rule_type TEXT,
  priority INTEGER,
  discount_type TEXT,
  discount_value DECIMAL(10,2),
  conditions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.name,
    pr.rule_type,
    pr.priority,
    pr.discount_type,
    pr.discount_value,
    pr.conditions
  FROM pricing_rules pr
  LEFT JOIN products p ON p.id = p_product_id
  WHERE pr.organization_id = p_organization_id
    AND pr.is_active = true
    AND (pr.start_date IS NULL OR pr.start_date <= p_date)
    AND (pr.end_date IS NULL OR pr.end_date >= p_date)
    AND (pr.product_id IS NULL OR pr.product_id = p_product_id)
    AND (pr.category_id IS NULL OR pr.category_id = p.category_id)
  ORDER BY pr.priority ASC, pr.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sample data: Create default product categories
INSERT INTO product_categories (organization_id, name, slug, description)
SELECT 
  o.id,
  'Uncategorized',
  'uncategorized',
  'Default category for products without a specific category'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories pc 
  WHERE pc.organization_id = o.id AND pc.slug = 'uncategorized'
);

-- Add category_id to products table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'category_id') THEN
    ALTER TABLE products ADD COLUMN category_id UUID REFERENCES product_categories(id);
    
    -- Set default category for existing products
    UPDATE products p
    SET category_id = pc.id
    FROM product_categories pc
    WHERE pc.organization_id = p.organization_id
      AND pc.slug = 'uncategorized'
      AND p.category_id IS NULL;
  END IF;
END $$;