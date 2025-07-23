-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables that have updated_at column
-- Warehouses table
CREATE TRIGGER update_warehouses_updated_at 
  BEFORE UPDATE ON warehouses 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Products table
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Inventory table
CREATE TRIGGER update_inventory_updated_at 
  BEFORE UPDATE ON inventory 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Organizations table
CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON organizations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- User profiles table
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Pricing rules table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing_rules') THEN
    CREATE TRIGGER update_pricing_rules_updated_at 
      BEFORE UPDATE ON pricing_rules 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Product pricing table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_pricing') THEN
    CREATE TRIGGER update_product_pricing_updated_at 
      BEFORE UPDATE ON product_pricing 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Customer pricing table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_pricing') THEN
    CREATE TRIGGER update_customer_pricing_updated_at 
      BEFORE UPDATE ON customer_pricing 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add comment
COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates the updated_at timestamp on row update';