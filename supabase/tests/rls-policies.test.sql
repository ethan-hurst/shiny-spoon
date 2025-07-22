-- RLS Policy Tests for PRP-002
-- Run these tests to verify Row Level Security policies are working correctly

BEGIN;

-- Helper function to set auth context
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true)::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  )
$$ LANGUAGE sql STABLE;

-- Test data setup
INSERT INTO organizations (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Org 1', 'org-1'),
  ('22222222-2222-2222-2222-222222222222', 'Org 2', 'org-2');

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user1@org1.com'),
  ('22222222-2222-2222-2222-222222222222', 'user2@org2.com');

INSERT INTO user_profiles (user_id, organization_id) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');

INSERT INTO products (id, organization_id, sku, name) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'PROD-1', 'Product 1'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'PROD-2', 'Product 2');

INSERT INTO warehouses (id, organization_id, name, code) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Warehouse 1', 'WH1'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Warehouse 2', 'WH2');

INSERT INTO inventory (id, organization_id, product_id, warehouse_id, quantity) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 100),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 200);

-- Test 1: User Isolation - Products
CREATE OR REPLACE FUNCTION test_rls_products_isolation() RETURNS void AS $$
DECLARE
  user1_count INT;
  user2_count INT;
BEGIN
  -- Set user 1 context
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  SELECT COUNT(*) INTO user1_count FROM products;
  
  -- Set user 2 context
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  SELECT COUNT(*) INTO user2_count FROM products;
  
  -- Verify isolation
  ASSERT user1_count = 1, 'User 1 should see only 1 product';
  ASSERT user2_count = 1, 'User 2 should see only 1 product';
  
  RAISE NOTICE '✅ Products RLS isolation test passed';
END;
$$ LANGUAGE plpgsql;

-- Test 2: User Isolation - Warehouses
CREATE OR REPLACE FUNCTION test_rls_warehouses_isolation() RETURNS void AS $$
DECLARE
  user1_count INT;
  user2_count INT;
BEGIN
  -- Set user 1 context
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  SELECT COUNT(*) INTO user1_count FROM warehouses;
  
  -- Set user 2 context
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  SELECT COUNT(*) INTO user2_count FROM warehouses;
  
  -- Verify isolation
  ASSERT user1_count = 1, 'User 1 should see only 1 warehouse';
  ASSERT user2_count = 1, 'User 2 should see only 1 warehouse';
  
  RAISE NOTICE '✅ Warehouses RLS isolation test passed';
END;
$$ LANGUAGE plpgsql;

-- Test 3: User Isolation - Inventory
CREATE OR REPLACE FUNCTION test_rls_inventory_isolation() RETURNS void AS $$
DECLARE
  user1_count INT;
  user2_count INT;
  user1_quantity INT;
BEGIN
  -- Set user 1 context
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  SELECT COUNT(*) INTO user1_count FROM inventory;
  SELECT quantity INTO user1_quantity FROM inventory LIMIT 1;
  
  -- Set user 2 context
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  SELECT COUNT(*) INTO user2_count FROM inventory;
  
  -- Verify isolation
  ASSERT user1_count = 1, 'User 1 should see only 1 inventory record';
  ASSERT user2_count = 1, 'User 2 should see only 1 inventory record';
  ASSERT user1_quantity = 100, 'User 1 should see correct quantity';
  
  RAISE NOTICE '✅ Inventory RLS isolation test passed';
END;
$$ LANGUAGE plpgsql;

-- Test 4: Cross-Organization Access Prevention
CREATE OR REPLACE FUNCTION test_rls_cross_org_prevention() RETURNS void AS $$
DECLARE
  other_org_product_visible BOOLEAN;
BEGIN
  -- Set user 1 context
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  
  -- Try to access user 2's product
  SELECT EXISTS(
    SELECT 1 FROM products WHERE id = '22222222-2222-2222-2222-222222222222'
  ) INTO other_org_product_visible;
  
  -- Verify prevention
  ASSERT NOT other_org_product_visible, 'User should not see other organization products';
  
  RAISE NOTICE '✅ Cross-organization access prevention test passed';
END;
$$ LANGUAGE plpgsql;

-- Test 5: Insert Policy Test
CREATE OR REPLACE FUNCTION test_rls_insert_policy() RETURNS void AS $$
DECLARE
  new_product_id UUID;
  insert_succeeded BOOLEAN := false;
BEGIN
  -- Set user 1 context
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  
  -- Try to insert a product for user's organization
  BEGIN
    INSERT INTO products (organization_id, sku, name) 
    VALUES ('11111111-1111-1111-1111-111111111111', 'TEST-1', 'Test Product')
    RETURNING id INTO new_product_id;
    insert_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    insert_succeeded := false;
  END;
  
  ASSERT insert_succeeded, 'User should be able to insert into their organization';
  
  -- Try to insert a product for another organization
  insert_succeeded := false;
  BEGIN
    INSERT INTO products (organization_id, sku, name) 
    VALUES ('22222222-2222-2222-2222-222222222222', 'TEST-2', 'Test Product 2');
    insert_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    insert_succeeded := false;
  END;
  
  ASSERT NOT insert_succeeded, 'User should not be able to insert into other organizations';
  
  RAISE NOTICE '✅ Insert policy test passed';
END;
$$ LANGUAGE plpgsql;

-- Test 6: Update Policy Test
CREATE OR REPLACE FUNCTION test_rls_update_policy() RETURNS void AS $$
DECLARE
  update_succeeded BOOLEAN := false;
BEGIN
  -- Set user 1 context
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  
  -- Try to update own organization's product
  BEGIN
    UPDATE products SET name = 'Updated Product 1' 
    WHERE id = '11111111-1111-1111-1111-111111111111';
    update_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    update_succeeded := false;
  END;
  
  ASSERT update_succeeded, 'User should be able to update their organization data';
  
  -- Try to update another organization's product
  update_succeeded := false;
  BEGIN
    UPDATE products SET name = 'Hacked Product 2' 
    WHERE id = '22222222-2222-2222-2222-222222222222';
    update_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    update_succeeded := false;
  END;
  
  ASSERT NOT update_succeeded, 'User should not be able to update other organization data';
  
  RAISE NOTICE '✅ Update policy test passed';
END;
$$ LANGUAGE plpgsql;

-- Test 7: Delete Policy Test
CREATE OR REPLACE FUNCTION test_rls_delete_policy() RETURNS void AS $$
DECLARE
  delete_succeeded BOOLEAN := false;
  temp_product_id UUID;
BEGIN
  -- Set user 1 context
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  
  -- Create a temporary product to delete
  INSERT INTO products (id, organization_id, sku, name) 
  VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'TEMP-1', 'Temp Product')
  RETURNING id INTO temp_product_id;
  
  -- Try to delete own organization's product
  BEGIN
    DELETE FROM products WHERE id = temp_product_id;
    delete_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    delete_succeeded := false;
  END;
  
  ASSERT delete_succeeded, 'User should be able to delete their organization data';
  
  -- Try to delete another organization's product
  delete_succeeded := false;
  BEGIN
    DELETE FROM products WHERE id = '22222222-2222-2222-2222-222222222222';
    delete_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    delete_succeeded := false;
  END;
  
  ASSERT NOT delete_succeeded, 'User should not be able to delete other organization data';
  
  RAISE NOTICE '✅ Delete policy test passed';
END;
$$ LANGUAGE plpgsql;

-- Main test runner
CREATE OR REPLACE FUNCTION run_all_rls_tests() RETURNS void AS $$
BEGIN
  RAISE NOTICE '🔍 Running RLS Policy Tests...';
  RAISE NOTICE '================================';
  
  PERFORM test_rls_products_isolation();
  PERFORM test_rls_warehouses_isolation();
  PERFORM test_rls_inventory_isolation();
  PERFORM test_rls_cross_org_prevention();
  PERFORM test_rls_insert_policy();
  PERFORM test_rls_update_policy();
  PERFORM test_rls_delete_policy();
  
  RAISE NOTICE '================================';
  RAISE NOTICE '🎉 All RLS tests passed!';
END;
$$ LANGUAGE plpgsql;

-- Run all tests
SELECT run_all_rls_tests();

-- Always rollback test data
ROLLBACK;