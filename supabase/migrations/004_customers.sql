-- Customer Management Schema
-- Supports B2B customer profiles, contacts, pricing tiers, and activity tracking

-- Customer tiers table (create first as it's referenced by customers)
CREATE TABLE customer_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL, -- 1 = highest tier
  discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  benefits JSONB DEFAULT '{}',
  requirements JSONB DEFAULT '{}', -- e.g., minimum annual spend
  color TEXT DEFAULT '#gray', -- For UI display
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique tier names per organization
  UNIQUE(organization_id, name),
  -- Ensure unique tier levels per organization
  UNIQUE(organization_id, level)
);

-- Main customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Basic information
  company_name TEXT NOT NULL,
  display_name TEXT, -- Optional shorter name
  tax_id TEXT,
  website TEXT,
  
  -- Classification
  tier_id UUID REFERENCES customer_tiers(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  customer_type TEXT DEFAULT 'standard' CHECK (customer_type IN ('standard', 'vip', 'partner')),
  
  -- Address information (JSONB for flexibility)
  billing_address JSONB DEFAULT '{}',
  shipping_address JSONB DEFAULT '{}',
  
  -- Business details
  credit_limit DECIMAL(10,2) DEFAULT 0 CHECK (credit_limit >= 0),
  payment_terms INTEGER DEFAULT 30 CHECK (payment_terms >= 0), -- Days
  currency TEXT DEFAULT 'USD',
  
  -- Settings
  settings JSONB DEFAULT '{}', -- Flexible customer-specific settings
  tags TEXT[] DEFAULT '{}', -- Customer tags for grouping
  
  -- Portal access
  portal_enabled BOOLEAN DEFAULT false,
  portal_subdomain TEXT UNIQUE,
  
  -- Metadata
  notes TEXT,
  internal_notes TEXT, -- Not visible to customer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Ensure unique company names per organization
  UNIQUE(organization_id, company_name)
);

-- Customer contacts
CREATE TABLE customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  
  -- Contact info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  mobile TEXT,
  
  -- Role and access
  role TEXT DEFAULT 'contact' CHECK (role IN ('primary', 'billing', 'shipping', 'contact')),
  is_primary BOOLEAN DEFAULT false,
  portal_access BOOLEAN DEFAULT false,
  
  -- Preferences
  preferred_contact_method TEXT DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'phone', 'mobile')),
  receives_order_updates BOOLEAN DEFAULT true,
  receives_marketing BOOLEAN DEFAULT false,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log for customer interactions
CREATE TABLE customer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  
  -- Activity details
  type TEXT NOT NULL CHECK (type IN ('order', 'payment', 'contact', 'note', 'email', 'phone', 'meeting', 'tier_change', 'status_change', 'contact_added', 'contact_removed', 'settings_update')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Related entities
  related_type TEXT, -- order, invoice, user, etc.
  related_id UUID,
  
  -- User tracking
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_customers_organization ON customers(organization_id);
CREATE INDEX idx_customers_tier ON customers(tier_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);
CREATE INDEX idx_contacts_customer ON customer_contacts(customer_id);
CREATE INDEX idx_contacts_email ON customer_contacts(email);
CREATE INDEX idx_activities_customer ON customer_activities(customer_id, created_at DESC);
CREATE INDEX idx_activities_organization ON customer_activities(organization_id, created_at DESC);
CREATE INDEX idx_activities_type ON customer_activities(type);

-- RLS (Row Level Security) policies
ALTER TABLE customer_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;

-- Customer Tiers policies
CREATE POLICY "Users can view own organization customer tiers" ON customer_tiers
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create customer tiers" ON customer_tiers
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization customer tiers" ON customer_tiers
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own organization customer tiers" ON customer_tiers
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Customers policies
CREATE POLICY "Users can view own organization customers" ON customers
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create customers" ON customers
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization customers" ON customers
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own organization customers" ON customers
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Customer Contacts policies (inherit from customer)
CREATE POLICY "Users can view contacts of own organization customers" ON customer_contacts
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers WHERE organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create contacts for own organization customers" ON customer_contacts
  FOR INSERT WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update contacts of own organization customers" ON customer_contacts
  FOR UPDATE USING (
    customer_id IN (
      SELECT id FROM customers WHERE organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete contacts of own organization customers" ON customer_contacts
  FOR DELETE USING (
    customer_id IN (
      SELECT id FROM customers WHERE organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Customer Activities policies
CREATE POLICY "Users can view own organization customer activities" ON customer_activities
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create customer activities" ON customer_activities
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Triggers
-- Update timestamp trigger for customer_tiers
CREATE TRIGGER update_customer_tiers_updated_at
  BEFORE UPDATE ON customer_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update timestamp trigger for customers
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update timestamp trigger for customer_contacts
CREATE TRIGGER update_customer_contacts_updated_at
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger to ensure only one primary contact per customer
CREATE OR REPLACE FUNCTION ensure_single_primary_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Set all other contacts for this customer to non-primary
    UPDATE customer_contacts
    SET is_primary = false
    WHERE customer_id = NEW.customer_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_contact_trigger
  BEFORE INSERT OR UPDATE ON customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_contact();

-- Function to log customer activities
CREATE OR REPLACE FUNCTION log_customer_activity(
  p_customer_id UUID,
  p_organization_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_related_type TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO customer_activities (
    customer_id,
    organization_id,
    type,
    title,
    description,
    metadata,
    related_type,
    related_id,
    created_by
  ) VALUES (
    p_customer_id,
    p_organization_id,
    p_type,
    p_title,
    p_description,
    p_metadata,
    p_related_type,
    p_related_id,
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get customer stats
CREATE OR REPLACE FUNCTION get_customer_stats(p_customer_id UUID)
RETURNS TABLE (
  total_orders INTEGER,
  total_revenue DECIMAL,
  last_order_date TIMESTAMPTZ,
  account_age_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(o.id)::INTEGER as total_orders,
    COALESCE(SUM(o.total_amount), 0)::DECIMAL as total_revenue,
    MAX(o.created_at) as last_order_date,
    EXTRACT(DAY FROM NOW() - c.created_at)::INTEGER as account_age_days
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.id
  WHERE c.id = p_customer_id
  GROUP BY c.id, c.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sample data: Insert default customer tiers for new organizations
CREATE OR REPLACE FUNCTION create_default_customer_tiers()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default tiers for new organization
  INSERT INTO customer_tiers (organization_id, name, level, discount_percentage, color, benefits) VALUES
    (NEW.id, 'Bronze', 3, 0, '#CD7F32', '{"free_shipping_threshold": 500}'::jsonb),
    (NEW.id, 'Silver', 2, 5, '#C0C0C0', '{"free_shipping_threshold": 250, "priority_support": true}'::jsonb),
    (NEW.id, 'Gold', 1, 10, '#FFD700', '{"free_shipping_threshold": 0, "priority_support": true, "dedicated_account_manager": true}'::jsonb);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default tiers when new organization is created
CREATE TRIGGER create_default_tiers_for_new_org
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_customer_tiers();

-- Create a view for customer with tier information
CREATE VIEW customers_with_tier AS
SELECT 
  c.*,
  t.name as tier_name,
  t.level as tier_level,
  t.discount_percentage as tier_discount,
  t.color as tier_color
FROM customers c
LEFT JOIN customer_tiers t ON c.tier_id = t.id;

-- Grant permissions on the view
GRANT SELECT ON customers_with_tier TO authenticated;