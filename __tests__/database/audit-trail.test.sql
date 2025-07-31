-- Test suite for audit trail database functionality
-- Run with: psql -d test_database -f __tests__/database/audit-trail.test.sql

BEGIN;

-- Setup test data
INSERT INTO organizations (id, name, created_at) VALUES 
('org-1', 'Test Organization 1', NOW()),
('org-2', 'Test Organization 2', NOW());

INSERT INTO auth.users (id, email, created_at) VALUES 
('user-1', 'admin@org1.com', NOW()),
('user-2', 'user@org1.com', NOW()),
('user-3', 'admin@org2.com', NOW());

INSERT INTO user_profiles (user_id, organization_id, role, full_name, email) VALUES 
('user-1', 'org-1', 'admin', 'Admin User', 'admin@org1.com'),
('user-2', 'org-1', 'member', 'Regular User', 'user@org1.com'),
('user-3', 'org-2', 'admin', 'Other Admin', 'admin@org2.com');

-- Test 1: Audit logs table structure
SELECT 'Test 1: Audit logs table exists and has correct structure' AS test_description;

DO $$ 
BEGIN
    -- Check table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        RAISE EXCEPTION 'audit_logs table does not exist';
    END IF;
    
    -- Check required columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'id') THEN
        RAISE EXCEPTION 'audit_logs.id column missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'organization_id') THEN
        RAISE EXCEPTION 'audit_logs.organization_id column missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_id') THEN
        RAISE EXCEPTION 'audit_logs.user_id column missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'action') THEN
        RAISE EXCEPTION 'audit_logs.action column missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_type') THEN
        RAISE EXCEPTION 'audit_logs.entity_type column missing';
    END IF;
    
    RAISE NOTICE 'PASSED: Audit logs table structure is correct';
END $$;

-- Test 2: Check constraints on action column
SELECT 'Test 2: Action column constraints work correctly' AS test_description;

DO $$
BEGIN
    -- Test valid action
    INSERT INTO audit_logs (organization_id, user_id, user_email, action, entity_type, created_at) 
    VALUES ('org-1', 'user-1', 'admin@org1.com', 'create', 'product', NOW());
    
    -- Test invalid action (should fail)
    BEGIN
        INSERT INTO audit_logs (organization_id, user_id, user_email, action, entity_type, created_at) 
        VALUES ('org-1', 'user-1', 'admin@org1.com', 'invalid_action', 'product', NOW());
        RAISE EXCEPTION 'Should have failed on invalid action';
    EXCEPTION 
        WHEN check_violation THEN
            RAISE NOTICE 'PASSED: Action constraint works correctly';
    END;
END $$;

-- Test 3: Indexes exist for performance
SELECT 'Test 3: Required indexes exist' AS test_description;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_org_created') THEN
        RAISE EXCEPTION 'idx_audit_logs_org_created index missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_user_created') THEN
        RAISE EXCEPTION 'idx_audit_logs_user_created index missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_entity') THEN
        RAISE EXCEPTION 'idx_audit_logs_entity index missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_action') THEN
        RAISE EXCEPTION 'idx_audit_logs_action index missing';
    END IF;
    
    RAISE NOTICE 'PASSED: All required indexes exist';
END $$;

-- Test 4: RLS policies work correctly
SELECT 'Test 4: Row Level Security policies enforce organization isolation' AS test_description;

-- Insert test audit logs for different organizations
INSERT INTO audit_logs (organization_id, user_id, user_email, action, entity_type, entity_name, created_at) VALUES 
('org-1', 'user-1', 'admin@org1.com', 'create', 'product', 'Product 1', NOW()),
('org-1', 'user-2', 'user@org1.com', 'update', 'product', 'Product 1', NOW()),
('org-2', 'user-3', 'admin@org2.com', 'create', 'product', 'Product 2', NOW());

-- Test RLS as user-1 (org-1)
SET LOCAL "auth.uid" = 'user-1';

DO $$
DECLARE
    log_count INTEGER;
BEGIN
    -- Should only see org-1 logs
    SELECT COUNT(*) INTO log_count FROM audit_logs;
    
    IF log_count != 2 THEN
        RAISE EXCEPTION 'RLS policy failed: user-1 should see 2 logs but saw %', log_count;
    END IF;
    
    -- Should not see org-2 logs
    SELECT COUNT(*) INTO log_count FROM audit_logs WHERE organization_id = 'org-2';
    
    IF log_count != 0 THEN
        RAISE EXCEPTION 'RLS policy failed: user-1 should not see org-2 logs';
    END IF;
    
    RAISE NOTICE 'PASSED: RLS policies work correctly for user-1';
END $$;

-- Test RLS as user-3 (org-2)
SET LOCAL "auth.uid" = 'user-3';

DO $$
DECLARE
    log_count INTEGER;
BEGIN
    -- Should only see org-2 logs
    SELECT COUNT(*) INTO log_count FROM audit_logs;
    
    IF log_count != 1 THEN
        RAISE EXCEPTION 'RLS policy failed: user-3 should see 1 log but saw %', log_count;
    END IF;
    
    -- Should not see org-1 logs
    SELECT COUNT(*) INTO log_count FROM audit_logs WHERE organization_id = 'org-1';
    
    IF log_count != 0 THEN
        RAISE EXCEPTION 'RLS policy failed: user-3 should not see org-1 logs';
    END IF;
    
    RAISE NOTICE 'PASSED: RLS policies work correctly for user-3';
END $$;

RESET "auth.uid";

-- Test 5: Audit logs with details view works
SELECT 'Test 5: Audit logs with details view combines data correctly' AS test_description;

DO $$
DECLARE
    view_count INTEGER;
    user_name TEXT;
    org_name TEXT;
BEGIN
    -- Check view exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'audit_logs_with_details') THEN
        RAISE EXCEPTION 'audit_logs_with_details view does not exist';
    END IF;
    
    -- Test view returns data with joined information
    SELECT COUNT(*) INTO view_count FROM audit_logs_with_details;
    
    IF view_count = 0 THEN
        RAISE EXCEPTION 'audit_logs_with_details view returns no data';
    END IF;
    
    -- Test that user details are joined correctly
    SELECT user_name, organization_name INTO user_name, org_name 
    FROM audit_logs_with_details 
    WHERE user_id = 'user-1' 
    LIMIT 1;
    
    IF user_name != 'Admin User' OR org_name != 'Test Organization 1' THEN
        RAISE EXCEPTION 'audit_logs_with_details view joins incorrect data';
    END IF;
    
    RAISE NOTICE 'PASSED: Audit logs with details view works correctly';
END $$;

-- Test 6: Retention policies table structure
SELECT 'Test 6: Retention policies table structure and constraints' AS test_description;

DO $$
BEGIN
    -- Check table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_retention_policies') THEN
        RAISE EXCEPTION 'audit_retention_policies table does not exist';
    END IF;
    
    -- Test inserting retention policy
    INSERT INTO audit_retention_policies (organization_id, entity_type, retention_days, is_active) 
    VALUES ('org-1', 'product', 90, true);
    
    -- Test unique constraint
    BEGIN
        INSERT INTO audit_retention_policies (organization_id, entity_type, retention_days, is_active) 
        VALUES ('org-1', 'product', 120, true);
        RAISE EXCEPTION 'Should have failed on unique constraint';
    EXCEPTION 
        WHEN unique_violation THEN
            RAISE NOTICE 'PASSED: Retention policies unique constraint works';
    END;
END $$;

-- Test 7: Retention policies RLS
SELECT 'Test 7: Retention policies RLS restricts access to admins only' AS test_description;

-- Test as regular user (should not have access)
SET LOCAL "auth.uid" = 'user-2';

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    -- Regular user should not see retention policies
    SELECT COUNT(*) INTO policy_count FROM audit_retention_policies;
    
    IF policy_count != 0 THEN
        RAISE EXCEPTION 'RLS policy failed: regular user should not see retention policies';
    END IF;
    
    RAISE NOTICE 'PASSED: Regular user cannot access retention policies';
END $$;

-- Test as admin user (should have access)
SET LOCAL "auth.uid" = 'user-1';

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    -- Admin user should see retention policies for their org
    SELECT COUNT(*) INTO policy_count FROM audit_retention_policies WHERE organization_id = 'org-1';
    
    IF policy_count != 1 THEN
        RAISE EXCEPTION 'RLS policy failed: admin user should see retention policies for their org';
    END IF;
    
    RAISE NOTICE 'PASSED: Admin user can access retention policies for their org';
END $$;

RESET "auth.uid";

-- Test 8: Cleanup function works correctly
SELECT 'Test 8: Cleanup function removes old audit logs based on retention policies' AS test_description;

-- Insert old audit logs
INSERT INTO audit_logs (organization_id, user_id, user_email, action, entity_type, entity_name, created_at) VALUES 
('org-1', 'user-1', 'admin@org1.com', 'create', 'product', 'Old Product 1', NOW() - INTERVAL '100 days'),
('org-1', 'user-1', 'admin@org1.com', 'create', 'inventory', 'Old Inventory 1', NOW() - INTERVAL '100 days'),
('org-1', 'user-1', 'admin@org1.com', 'create', 'product', 'Recent Product', NOW() - INTERVAL '50 days');

-- Set retention policy for products to 90 days
INSERT INTO audit_retention_policies (organization_id, entity_type, retention_days, is_active) 
VALUES ('org-1', 'product', 90, true)
ON CONFLICT (organization_id, entity_type) 
DO UPDATE SET retention_days = 90, is_active = true;

DO $$
DECLARE
    old_count INTEGER;
    new_count INTEGER;
BEGIN
    -- Count logs before cleanup
    SELECT COUNT(*) INTO old_count FROM audit_logs WHERE organization_id = 'org-1';
    
    -- Run cleanup function
    PERFORM cleanup_audit_logs();
    
    -- Count logs after cleanup
    SELECT COUNT(*) INTO new_count FROM audit_logs WHERE organization_id = 'org-1';
    
    -- Should have removed the old product log but kept others
    IF new_count >= old_count THEN
        RAISE EXCEPTION 'Cleanup function did not remove old logs';
    END IF;
    
    -- Check that recent product log is still there
    IF NOT EXISTS (SELECT 1 FROM audit_logs WHERE entity_name = 'Recent Product') THEN
        RAISE EXCEPTION 'Cleanup function removed logs that should be retained';
    END IF;
    
    -- Check that old product log was removed
    IF EXISTS (SELECT 1 FROM audit_logs WHERE entity_name = 'Old Product 1') THEN
        RAISE EXCEPTION 'Cleanup function did not remove old logs';
    END IF;
    
    -- Check that inventory log was kept (no specific retention policy)
    IF NOT EXISTS (SELECT 1 FROM audit_logs WHERE entity_name = 'Old Inventory 1') THEN
        RAISE EXCEPTION 'Cleanup function removed logs without retention policy';
    END IF;
    
    RAISE NOTICE 'PASSED: Cleanup function works correctly';
END $$;

-- Test 9: supa_audit extension is enabled (if available)
SELECT 'Test 9: Check if supa_audit extension is available' AS test_description;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supa_audit') THEN
        RAISE NOTICE 'PASSED: supa_audit extension is installed';
        
        -- Check if audit.enable_tracking function exists
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enable_tracking' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'audit')) THEN
            RAISE NOTICE 'PASSED: audit.enable_tracking function is available';
        ELSE
            RAISE NOTICE 'WARNING: audit.enable_tracking function not found';
        END IF;
    ELSE
        RAISE NOTICE 'WARNING: supa_audit extension is not installed (this may be expected in test environment)';
    END IF;
END $$;

-- Test 10: JSON columns handle complex data correctly
SELECT 'Test 10: JSON columns store and retrieve complex data correctly' AS test_description;

DO $$
DECLARE
    test_old_values JSONB := '{"name": "Old Name", "price": 100, "tags": ["electronics", "mobile"]}';
    test_new_values JSONB := '{"name": "New Name", "price": 150, "tags": ["electronics", "smartphone"]}';
    test_metadata JSONB := '{"reason": "price_update", "user_agent": "test-browser", "ip": "192.168.1.1"}';
    retrieved_old JSONB;
    retrieved_new JSONB;
    retrieved_meta JSONB;
BEGIN
    -- Insert audit log with complex JSON data
    INSERT INTO audit_logs (
        organization_id, user_id, user_email, action, entity_type, entity_name,
        old_values, new_values, metadata, created_at
    ) VALUES (
        'org-1', 'user-1', 'admin@org1.com', 'update', 'product', 'Test Product',
        test_old_values, test_new_values, test_metadata, NOW()
    );
    
    -- Retrieve and verify JSON data
    SELECT old_values, new_values, metadata 
    INTO retrieved_old, retrieved_new, retrieved_meta
    FROM audit_logs 
    WHERE entity_name = 'Test Product' AND action = 'update';
    
    -- Check old_values
    IF retrieved_old->>'name' != 'Old Name' OR (retrieved_old->>'price')::INTEGER != 100 THEN
        RAISE EXCEPTION 'old_values JSON data not stored/retrieved correctly';
    END IF;
    
    -- Check new_values
    IF retrieved_new->>'name' != 'New Name' OR (retrieved_new->>'price')::INTEGER != 150 THEN
        RAISE EXCEPTION 'new_values JSON data not stored/retrieved correctly';
    END IF;
    
    -- Check metadata
    IF retrieved_meta->>'reason' != 'price_update' OR retrieved_meta->>'ip' != '192.168.1.1' THEN
        RAISE EXCEPTION 'metadata JSON data not stored/retrieved correctly';
    END IF;
    
    -- Test JSON array access
    IF NOT (retrieved_old->'tags' ? 'electronics') THEN
        RAISE EXCEPTION 'JSON array data not accessible correctly';
    END IF;
    
    RAISE NOTICE 'PASSED: JSON columns handle complex data correctly';
END $$;

-- Test 11: Foreign key constraints work
SELECT 'Test 11: Foreign key constraints enforce data integrity' AS test_description;

DO $$
BEGIN
    -- Test invalid organization_id (should fail)
    BEGIN
        INSERT INTO audit_logs (organization_id, user_id, user_email, action, entity_type, created_at) 
        VALUES ('invalid-org', 'user-1', 'admin@org1.com', 'create', 'product', NOW());
        RAISE EXCEPTION 'Should have failed on invalid organization_id';
    EXCEPTION 
        WHEN foreign_key_violation THEN
            RAISE NOTICE 'PASSED: organization_id foreign key constraint works';
    END;
    
    -- Test invalid user_id (should fail)
    BEGIN
        INSERT INTO audit_logs (organization_id, user_id, user_email, action, entity_type, created_at) 
        VALUES ('org-1', 'invalid-user', 'admin@org1.com', 'create', 'product', NOW());
        RAISE EXCEPTION 'Should have failed on invalid user_id';
    EXCEPTION 
        WHEN foreign_key_violation THEN
            RAISE NOTICE 'PASSED: user_id foreign key constraint works';
    END;
END $$;

-- Test 12: Performance with large dataset
SELECT 'Test 12: Query performance with indexes' AS test_description;

DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration INTERVAL;
BEGIN
    -- Insert a batch of audit logs for performance testing
    INSERT INTO audit_logs (organization_id, user_id, user_email, action, entity_type, entity_name, created_at)
    SELECT 
        'org-1',
        'user-1',
        'admin@org1.com',
        (ARRAY['create', 'update', 'delete', 'view'])[1 + (i % 4)],
        (ARRAY['product', 'inventory', 'order', 'customer'])[1 + (i % 4)],
        'Entity ' || i,
        NOW() - (i || ' minutes')::INTERVAL
    FROM generate_series(1, 1000) AS i;
    
    -- Test query performance with organization filter
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM audit_logs WHERE organization_id = 'org-1';
    end_time := clock_timestamp();
    duration := end_time - start_time;
    
    IF duration > INTERVAL '1 second' THEN
        RAISE WARNING 'Query with organization filter took too long: %', duration;
    ELSE
        RAISE NOTICE 'PASSED: Organization filter query performs well (% ms)', EXTRACT(milliseconds FROM duration);
    END IF;
    
    -- Test query performance with date range filter
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM audit_logs 
    WHERE organization_id = 'org-1' 
    AND created_at >= NOW() - INTERVAL '1 hour';
    end_time := clock_timestamp();
    duration := end_time - start_time;
    
    IF duration > INTERVAL '1 second' THEN
        RAISE WARNING 'Query with date filter took too long: %', duration;
    ELSE
        RAISE NOTICE 'PASSED: Date range filter query performs well (% ms)', EXTRACT(milliseconds FROM duration);
    END IF;
END $$;

-- Cleanup test data
ROLLBACK;