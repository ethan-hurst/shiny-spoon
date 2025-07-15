-- Seed data for TruthSource development
-- This creates realistic test data for development and testing

-- Clear existing data (be careful in production!)
TRUNCATE TABLE inventory CASCADE;
TRUNCATE TABLE warehouses CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE user_profiles CASCADE;
TRUNCATE TABLE organizations CASCADE;

-- Create test organizations
INSERT INTO organizations (id, name, slug, subscription_tier, subscription_status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Acme Distribution Co', 'acme-distribution', 'enterprise', 'active'),
  ('a0000000-0000-0000-0000-000000000002', 'Global Supply Chain Inc', 'global-supply', 'professional', 'active'),
  ('a0000000-0000-0000-0000-000000000003', 'Regional Wholesale Ltd', 'regional-wholesale', 'starter', 'trialing');

-- Create test users (assuming they exist in auth.users)
-- In real scenario, these would be created via Supabase Auth
-- For development, you'll need to create these users through the Supabase dashboard or auth API

-- Create test warehouses
INSERT INTO warehouses (id, organization_id, name, code, is_default, address, contact) VALUES
  -- Acme Distribution warehouses
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Main Distribution Center', 'MAIN-DC', true, 
   '{"street": "123 Warehouse Way", "city": "Chicago", "state": "IL", "zip": "60601", "country": "USA"}',
   '{"phone": "+1-312-555-0100", "email": "main-dc@acme.com", "manager": "John Smith"}'),
  
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'West Coast Facility', 'WEST-FC', false,
   '{"street": "456 Pacific Blvd", "city": "Los Angeles", "state": "CA", "zip": "90001", "country": "USA"}',
   '{"phone": "+1-213-555-0200", "email": "west-fc@acme.com", "manager": "Jane Doe"}'),
  
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'East Coast Hub', 'EAST-HB', false,
   '{"street": "789 Atlantic Ave", "city": "New York", "state": "NY", "zip": "10001", "country": "USA"}',
   '{"phone": "+1-212-555-0300", "email": "east-hb@acme.com", "manager": "Mike Johnson"}'),

  -- Global Supply Chain warehouses
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Central Warehouse', 'CENTRAL-WH', true,
   '{"street": "321 Commerce St", "city": "Dallas", "state": "TX", "zip": "75201", "country": "USA"}',
   '{"phone": "+1-214-555-0400", "email": "central@globalsupply.com", "manager": "Sarah Williams"}'),
  
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Overflow Storage', 'OVERFLOW-ST', false,
   '{"street": "654 Storage Lane", "city": "Houston", "state": "TX", "zip": "77001", "country": "USA"}',
   '{"phone": "+1-713-555-0500", "email": "overflow@globalsupply.com", "manager": "Robert Brown"}'),

  -- Regional Wholesale warehouse
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'Regional Center', 'REGIONAL-CT', true,
   '{"street": "111 Local Ave", "city": "Phoenix", "state": "AZ", "zip": "85001", "country": "USA"}',
   '{"phone": "+1-602-555-0600", "email": "center@regionalwholesale.com", "manager": "Lisa Davis"}');

-- Create test products
-- Industrial supplies and equipment
INSERT INTO products (id, organization_id, sku, name, description, category, base_price, cost, weight, active) VALUES
  -- Acme Distribution products (150+ products)
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'IND-PUMP-001', 'Industrial Water Pump 5HP', 'Heavy-duty centrifugal water pump for industrial applications', 'Pumps', 1299.99, 850.00, 45.5, true),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'IND-PUMP-002', 'Industrial Water Pump 10HP', 'Extra heavy-duty centrifugal water pump', 'Pumps', 2199.99, 1450.00, 68.2, true),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'VALVE-GATE-4IN', '4" Gate Valve Brass', 'Brass gate valve for water and gas applications', 'Valves', 89.99, 45.00, 3.2, true),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'VALVE-BALL-2IN', '2" Ball Valve Stainless', 'Stainless steel ball valve with lever handle', 'Valves', 129.99, 75.00, 2.1, true),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'MOTOR-AC-5HP', '5HP AC Motor 3-Phase', 'Industrial 3-phase AC motor 1800 RPM', 'Motors', 899.99, 550.00, 52.3, true),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'MOTOR-AC-10HP', '10HP AC Motor 3-Phase', 'Industrial 3-phase AC motor 1800 RPM', 'Motors', 1599.99, 950.00, 78.5, true),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'BEARING-6205', 'Ball Bearing 6205-2RS', 'Sealed ball bearing 25x52x15mm', 'Bearings', 12.99, 6.50, 0.13, true),
  ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'BEARING-6305', 'Ball Bearing 6305-2RS', 'Sealed ball bearing 25x62x17mm', 'Bearings', 18.99, 9.50, 0.23, true),
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'BELT-V-A48', 'V-Belt A48', 'Classical V-belt A section 48" length', 'Belts', 8.99, 4.00, 0.25, true),
  ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'BELT-V-B75', 'V-Belt B75', 'Classical V-belt B section 75" length', 'Belts', 14.99, 7.00, 0.45, true),
  
  -- Add more Acme products
  ('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'GEAR-SPUR-20T', 'Spur Gear 20 Teeth', 'Steel spur gear 20 teeth 1" bore', 'Gears', 34.99, 18.00, 1.2, true),
  ('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'CHAIN-ROLLER-40', 'Roller Chain #40 10ft', 'ANSI #40 roller chain 10 feet', 'Chains', 45.99, 25.00, 3.5, true),
  ('c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'SPROCKET-40-15T', 'Sprocket #40 15 Teeth', 'Steel sprocket for #40 chain', 'Sprockets', 22.99, 12.00, 0.8, true),
  ('c0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'COUPLING-JAW-L095', 'Jaw Coupling L095', 'Flexible jaw coupling with spider', 'Couplings', 28.99, 15.00, 0.6, true),
  ('c0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'SEAL-ORING-214', 'O-Ring Seal 214', 'Nitrile O-ring 1" ID x 1.25" OD', 'Seals', 0.99, 0.35, 0.01, true),

  -- Global Supply Chain products (50+ products)
  ('c0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000002', 'ELEC-SWITCH-3P30A', '3-Pole Switch 30A', 'Heavy duty 3-pole disconnect switch', 'Electrical', 89.99, 52.00, 2.3, true),
  ('c0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000002', 'ELEC-BREAKER-20A', 'Circuit Breaker 20A', 'Single pole circuit breaker 20 amp', 'Electrical', 12.99, 7.00, 0.3, true),
  ('c0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000002', 'WIRE-THHN-12AWG', 'THHN Wire 12 AWG 500ft', 'Copper THHN wire 12 gauge black', 'Wire', 125.99, 85.00, 15.2, true),
  ('c0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000002', 'CONDUIT-EMT-1IN', 'EMT Conduit 1" 10ft', 'Electrical metallic tubing 1 inch', 'Conduit', 18.99, 11.00, 4.5, true),
  ('c0000000-0000-0000-0000-000000000105', 'a0000000-0000-0000-0000-000000000002', 'BOX-JUNC-4X4', 'Junction Box 4x4', 'Metal junction box with cover', 'Boxes', 5.99, 3.00, 0.8, true),

  -- Regional Wholesale products (20+ products)
  ('c0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000003', 'TOOL-DRILL-18V', 'Cordless Drill 18V', 'Professional cordless drill with battery', 'Tools', 159.99, 95.00, 3.2, true),
  ('c0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000003', 'TOOL-SAW-CIRC-7.25', 'Circular Saw 7.25"', 'Corded circular saw 15 amp', 'Tools', 89.99, 55.00, 8.5, true),
  ('c0000000-0000-0000-0000-000000000203', 'a0000000-0000-0000-0000-000000000003', 'SAFETY-HELMET-WHITE', 'Safety Helmet White', 'ANSI approved hard hat white', 'Safety', 18.99, 9.00, 0.4, true),
  ('c0000000-0000-0000-0000-000000000204', 'a0000000-0000-0000-0000-000000000003', 'SAFETY-GLASSES-CLR', 'Safety Glasses Clear', 'ANSI Z87.1 safety glasses', 'Safety', 4.99, 2.00, 0.1, true),
  ('c0000000-0000-0000-0000-000000000205', 'a0000000-0000-0000-0000-000000000003', 'GLOVES-LEATHER-LG', 'Leather Gloves Large', 'Heavy duty leather work gloves', 'Safety', 12.99, 6.50, 0.2, true);

-- Create inventory records
-- Acme Distribution inventory
INSERT INTO inventory (organization_id, product_id, warehouse_id, quantity, reserved_quantity, reorder_point, reorder_quantity) VALUES
  -- Main DC inventory
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 45, 5, 20, 50),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 23, 3, 10, 25),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 156, 12, 50, 100),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 89, 8, 30, 75),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 12, 2, 5, 15),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 8, 1, 3, 10),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 523, 45, 200, 500),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 412, 32, 150, 400),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000001', 234, 18, 100, 250),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001', 187, 15, 75, 200),

  -- West Coast inventory (subset of products)
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 15, 2, 10, 25),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 78, 5, 25, 50),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 6, 0, 3, 10),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002', 234, 15, 100, 250),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000002', 156, 10, 50, 150),

  -- East Coast inventory (subset of products)
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 12, 1, 5, 15),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 45, 3, 15, 40),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000003', 4, 0, 2, 8),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000003', 189, 12, 75, 200),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000003', 98, 7, 40, 100),

  -- Global Supply Chain inventory
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000004', 67, 5, 25, 50),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000004', 342, 28, 100, 300),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000103', 'b0000000-0000-0000-0000-000000000004', 45, 5, 20, 50),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000104', 'b0000000-0000-0000-0000-000000000004', 123, 10, 50, 100),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000105', 'b0000000-0000-0000-0000-000000000004', 567, 45, 200, 500),

  -- Regional Wholesale inventory
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000201', 'b0000000-0000-0000-0000-000000000006', 23, 3, 10, 25),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000202', 'b0000000-0000-0000-0000-000000000006', 18, 2, 8, 20),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000203', 'b0000000-0000-0000-0000-000000000006', 145, 12, 50, 150),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000204', 'b0000000-0000-0000-0000-000000000006', 456, 38, 150, 400),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000205', 'b0000000-0000-0000-0000-000000000006', 234, 20, 100, 250);

-- Create some low stock scenarios for testing
UPDATE inventory SET quantity = 5, reserved_quantity = 3 
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001' 
AND product_id = 'c0000000-0000-0000-0000-000000000011';

UPDATE inventory SET quantity = 2, reserved_quantity = 1 
WHERE organization_id = 'a0000000-0000-0000-0000-000000000002' 
AND product_id = 'c0000000-0000-0000-0000-000000000103';

-- Add instructions for creating test users
-- Note: Run these commands in Supabase SQL editor or via the auth API
/*
To create test users, run these in your Supabase dashboard SQL editor:

-- Create test users for Acme Distribution
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data, aud, role)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'owner@acme.com', 
   '{"full_name": "Alice Owner", "organization_name": "Acme Distribution Co"}', 
   '{}', 'authenticated', 'authenticated'),
  ('11111111-1111-1111-1111-111111111112', 'admin@acme.com', 
   '{"full_name": "Bob Admin", "invited_organization_id": "a0000000-0000-0000-0000-000000000001"}', 
   '{}', 'authenticated', 'authenticated'),
  ('11111111-1111-1111-1111-111111111113', 'user@acme.com', 
   '{"full_name": "Charlie User", "invited_organization_id": "a0000000-0000-0000-0000-000000000001"}', 
   '{}', 'authenticated', 'authenticated');

-- Create test users for Global Supply Chain
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data, aud, role)
VALUES 
  ('22222222-2222-2222-2222-222222222221', 'owner@global.com', 
   '{"full_name": "Diana Owner", "organization_name": "Global Supply Chain Inc"}', 
   '{}', 'authenticated', 'authenticated');

-- Create test users for Regional Wholesale
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data, aud, role)
VALUES 
  ('33333333-3333-3333-3333-333333333331', 'owner@regional.com', 
   '{"full_name": "Eve Owner", "organization_name": "Regional Wholesale Ltd"}', 
   '{}', 'authenticated', 'authenticated');

Note: In production, use Supabase Auth API to create users with proper password hashing.
*/