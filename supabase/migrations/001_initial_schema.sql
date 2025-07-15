-- Initial Schema Migration for TruthSource
-- Multi-tenant B2B e-commerce data accuracy platform

-- Enable UUID extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CORE TABLES
-- =============================================

-- Organizations table (multi-tenant root)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_tier TEXT DEFAULT 'starter' 
    CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  subscription_status TEXT DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'member' 
    CHECK (role IN ('owner', 'admin', 'member')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products catalog
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  base_price DECIMAL(12,2) DEFAULT 0 CHECK (base_price >= 0),
  cost DECIMAL(12,2) DEFAULT 0 CHECK (cost >= 0),
  weight DECIMAL(10,3),
  dimensions JSONB DEFAULT '{}',
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_sku_per_org UNIQUE(organization_id, sku)
);

-- Warehouse locations
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address JSONB DEFAULT '{}',
  contact JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_warehouse_code UNIQUE(organization_id, code)
);

-- Inventory levels
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
  reorder_point INTEGER,
  reorder_quantity INTEGER,
  last_counted_at TIMESTAMPTZ,
  last_counted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_product_warehouse UNIQUE(product_id, warehouse_id),
  CONSTRAINT reserved_not_greater_than_quantity CHECK (reserved_quantity <= quantity)
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS policies
CREATE OR REPLACE FUNCTION get_user_organization_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT organization_id FROM user_profiles WHERE user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_org_member(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = user_uuid 
    AND organization_id = org_uuid
  );
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_org_admin(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = user_uuid 
    AND organization_id = org_uuid 
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Organizations policies
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = get_user_organization_id(auth.uid()));

CREATE POLICY "Only owners can update organization"
  ON organizations FOR UPDATE
  USING (
    id = get_user_organization_id(auth.uid()) 
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND organization_id = id 
      AND role = 'owner'
    )
  );

-- User profiles policies  
CREATE POLICY "Users can view profiles in their org"
  ON user_profiles FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can insert profiles in their org"
  ON user_profiles FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND is_org_admin(auth.uid(), organization_id)
  );

CREATE POLICY "Admins can update profiles in their org"
  ON user_profiles FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND is_org_admin(auth.uid(), organization_id)
  );

-- Products policies
CREATE POLICY "Users can view products in their org"
  ON products FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert products in their org"
  ON products FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update products in their org"
  ON products FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Soft delete policy - admins can mark products as inactive
CREATE POLICY "Admins can soft delete products in their org"
  ON products FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND is_org_admin(auth.uid(), organization_id)
    AND (active = false OR OLD.active = true) -- Only allow setting active to false
  );

-- Warehouses policies
CREATE POLICY "Users can view warehouses in their org"
  ON warehouses FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage warehouses in their org"
  ON warehouses FOR ALL
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND is_org_admin(auth.uid(), organization_id)
  );

-- Inventory policies
CREATE POLICY "Users can view inventory in their org"
  ON inventory FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update inventory in their org"
  ON inventory FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert inventory in their org"
  ON inventory FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete inventory in their org"
  ON inventory FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND is_org_admin(auth.uid(), organization_id)
  );

-- =============================================
-- TRIGGERS AND FUNCTIONS
-- =============================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  -- Extract organization name from metadata or use default
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    split_part(NEW.email, '@', 2), -- Use domain as org name
    'Personal Organization'
  );

  -- Generate slug from organization name
  org_slug := LOWER(REGEXP_REPLACE(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  
  -- Remove leading/trailing hyphens
  org_slug := TRIM(BOTH '-' FROM org_slug);
  
  -- Ensure slug is unique by appending random suffix if needed
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  -- Try to get invited organization ID from metadata
  IF NEW.raw_user_meta_data->>'invited_organization_id' IS NOT NULL THEN
    org_id := (NEW.raw_user_meta_data->>'invited_organization_id')::UUID;
  ELSE
    -- Create new organization
    INSERT INTO organizations (name, slug)
    VALUES (org_name, org_slug)
    RETURNING id INTO org_id;
  END IF;

  -- Create user profile
  INSERT INTO user_profiles (
    user_id, 
    organization_id, 
    full_name, 
    role
  ) VALUES (
    NEW.id,
    org_id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_app_meta_data->>'full_name',
      split_part(NEW.email, '@', 1) -- Use email prefix as name
    ),
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM user_profiles WHERE organization_id = org_id
      ) THEN 'owner' -- First user is owner
      ELSE 'member' -- Subsequent users are members
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update timestamp triggers to all tables
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- User profiles indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_org_id ON user_profiles(organization_id);
CREATE INDEX idx_user_profiles_org_role ON user_profiles(organization_id, role);

-- Products indexes
CREATE INDEX idx_products_org_id ON products(organization_id);
CREATE INDEX idx_products_org_sku ON products(organization_id, sku);
CREATE INDEX idx_products_org_active ON products(organization_id, active) WHERE active = true;
CREATE INDEX idx_products_org_category ON products(organization_id, category);

-- Warehouses indexes
CREATE INDEX idx_warehouses_org_id ON warehouses(organization_id);
CREATE INDEX idx_warehouses_org_code ON warehouses(organization_id, code);
CREATE INDEX idx_warehouses_org_default ON warehouses(organization_id, is_default) WHERE is_default = true;

-- Inventory indexes
CREATE INDEX idx_inventory_org_id ON inventory(organization_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse_id ON inventory(warehouse_id);
CREATE INDEX idx_inventory_product_warehouse ON inventory(product_id, warehouse_id);
CREATE INDEX idx_inventory_low_stock ON inventory(organization_id, warehouse_id) 
  WHERE quantity <= reorder_point;
CREATE INDEX idx_inventory_org_product ON inventory(organization_id, product_id);

-- =============================================
-- INITIAL DATA / CONFIGURATION
-- =============================================

-- Create a default organization for development/testing (optional)
-- This will be removed in production
DO $$
BEGIN
  IF current_setting('app.env', true) = 'development' THEN
    INSERT INTO organizations (id, name, slug, subscription_tier)
    VALUES (
      '00000000-0000-0000-0000-000000000000'::UUID,
      'Demo Organization',
      'demo-org',
      'enterprise'
    ) ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;