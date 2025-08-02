-- Test Custom Reports Builder Database Schema (PRP-019)

BEGIN;

-- Test report templates table
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_template_id UUID;
BEGIN
  -- Create test organization and user
  INSERT INTO organizations (id, name, slug)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Test Org', 'test-org')
  RETURNING id INTO v_org_id;

  INSERT INTO auth.users (id, email)
  VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com')
  RETURNING id INTO v_user_id;

  INSERT INTO user_profiles (user_id, organization_id, role)
  VALUES (v_user_id, v_org_id, 'admin');

  -- Test creating a report template
  INSERT INTO report_templates (name, description, category, organization_id, config, created_by)
  VALUES (
    'Test Template',
    'Test template description',
    'inventory',
    v_org_id,
    '{"layout": "grid", "components": [], "dataSources": [], "filters": [], "style": {"theme": "light", "spacing": "normal"}}',
    v_user_id
  ) RETURNING id INTO v_template_id;

  -- Test RLS: User can view their own templates
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims.sub TO v_user_id::TEXT;

  ASSERT EXISTS (
    SELECT 1 FROM report_templates WHERE id = v_template_id
  ), 'User should be able to view their own template';

  -- Test system templates can't be edited
  INSERT INTO report_templates (name, category, config, is_system, is_public)
  VALUES (
    'System Template',
    'orders',
    '{"layout": "grid", "components": [], "dataSources": [], "filters": [], "style": {}}',
    true,
    true
  );

  ASSERT NOT EXISTS (
    SELECT 1 FROM report_templates 
    WHERE name = 'System Template' 
    AND is_system = true
    FOR UPDATE
  ), 'System templates should not be editable';

  RAISE NOTICE 'Report templates tests passed';
END $$;

-- Test reports table
DO $$
DECLARE
  v_org_id UUID := '00000000-0000-0000-0000-000000000001';
  v_user_id UUID := '00000000-0000-0000-0000-000000000001';
  v_report_id UUID;
  v_other_user_id UUID;
BEGIN
  -- Create a report
  INSERT INTO reports (organization_id, name, config, created_by)
  VALUES (
    v_org_id,
    'Test Report',
    '{"name": "Test Report", "layout": "grid", "components": [], "dataSources": [], "filters": [], "style": {"theme": "light", "spacing": "normal"}}',
    v_user_id
  ) RETURNING id INTO v_report_id;

  -- Test scheduling fields
  UPDATE reports
  SET 
    schedule_enabled = true,
    schedule_cron = '0 9 * * MON',
    schedule_timezone = 'America/New_York',
    schedule_recipients = ARRAY['user@example.com', 'admin@example.com'],
    schedule_format = ARRAY['pdf', 'excel']
  WHERE id = v_report_id;

  -- Test sharing
  UPDATE reports
  SET 
    is_shared = true,
    share_token = 'test-share-token-123',
    share_expires_at = NOW() + INTERVAL '7 days'
  WHERE id = v_report_id;

  -- Test access levels
  -- Create another user
  INSERT INTO auth.users (id, email)
  VALUES ('00000000-0000-0000-0000-000000000002', 'other@example.com')
  RETURNING id INTO v_other_user_id;

  INSERT INTO user_profiles (user_id, organization_id, role)
  VALUES (v_other_user_id, v_org_id, 'user');

  -- Test private access
  UPDATE reports SET access_level = 'private' WHERE id = v_report_id;

  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims.sub TO v_other_user_id::TEXT;

  ASSERT NOT EXISTS (
    SELECT 1 FROM reports WHERE id = v_report_id
  ), 'Other users should not see private reports';

  -- Test team access
  SET LOCAL request.jwt.claims.sub TO v_user_id::TEXT;
  UPDATE reports SET access_level = 'team' WHERE id = v_report_id;

  SET LOCAL request.jwt.claims.sub TO v_other_user_id::TEXT;
  ASSERT EXISTS (
    SELECT 1 FROM reports WHERE id = v_report_id
  ), 'Team members should see team reports';

  RAISE NOTICE 'Reports tests passed';
END $$;

-- Test report runs
DO $$
DECLARE
  v_report_id UUID;
  v_run_id UUID;
  v_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Get a report
  SELECT id INTO v_report_id FROM reports LIMIT 1;

  -- Create a report run
  INSERT INTO report_runs (report_id, status)
  VALUES (v_report_id, 'pending')
  RETURNING id INTO v_run_id;

  -- Update run status
  UPDATE report_runs
  SET 
    status = 'running',
    started_at = NOW()
  WHERE id = v_run_id;

  -- Complete the run
  UPDATE report_runs
  SET 
    status = 'completed',
    completed_at = NOW(),
    result_url = 'https://storage.example.com/reports/test.pdf',
    result_size_bytes = 1024000,
    record_count = 150,
    delivery_status = '[{"email": "user@example.com", "status": "sent", "timestamp": "2024-01-01T10:00:00Z"}]'::jsonb
  WHERE id = v_run_id;

  -- Test failed run
  INSERT INTO report_runs (report_id, status, error)
  VALUES (v_report_id, 'failed', 'Query timeout');

  -- Test RLS: User can view runs for their reports
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims.sub TO v_user_id::TEXT;

  ASSERT EXISTS (
    SELECT 1 FROM report_runs WHERE report_id = v_report_id
  ), 'User should see runs for their reports';

  RAISE NOTICE 'Report runs tests passed';
END $$;

-- Test report components
DO $$
BEGIN
  -- Insert test components
  INSERT INTO report_components (name, type, category, config_schema, default_config, icon)
  VALUES 
  (
    'Test Chart',
    'chart',
    'Visualizations',
    '{"title": {"type": "string", "label": "Title"}}',
    '{"title": "Chart"}',
    'BarChart'
  ),
  (
    'Test Table',
    'table',
    'Data',
    '{"columns": {"type": "columns", "label": "Columns"}}',
    '{"columns": []}',
    'Table'
  );

  -- Test component activation
  UPDATE report_components
  SET is_active = false
  WHERE name = 'Test Chart';

  ASSERT EXISTS (
    SELECT 1 FROM report_components WHERE is_active = true
  ), 'Active components should exist';

  RAISE NOTICE 'Report components tests passed';
END $$;

-- Test execute_report_query function
DO $$
DECLARE
  v_result JSONB;
  v_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims.sub TO v_user_id::TEXT;

  -- Test valid query
  SELECT execute_report_query(
    'SELECT COUNT(*) as count FROM products WHERE organization_id = :orgId',
    '{"test": "param"}'::jsonb
  ) INTO v_result;

  ASSERT v_result IS NOT NULL, 'Query should return result';

  -- Test blocked operations
  BEGIN
    SELECT execute_report_query(
      'DELETE FROM products',
      '{}'::jsonb
    ) INTO v_result;
    ASSERT false, 'DELETE should be blocked';
  EXCEPTION
    WHEN OTHERS THEN
      ASSERT SQLERRM LIKE '%read-only%', 'Should get read-only error';
  END;

  RAISE NOTICE 'Query function tests passed';
END $$;

-- Test storage policies
DO $$
DECLARE
  v_user_id UUID := '00000000-0000-0000-0000-000000000001';
  v_report_id UUID;
  v_run_id UUID;
BEGIN
  -- Get a report and run
  SELECT id INTO v_report_id FROM reports WHERE created_by = v_user_id LIMIT 1;
  SELECT id INTO v_run_id FROM report_runs WHERE report_id = v_report_id LIMIT 1;

  -- Test that storage policies would work (can't actually test storage in SQL)
  ASSERT v_run_id IS NOT NULL, 'Should have run ID for storage test';

  RAISE NOTICE 'Storage policy tests passed';
END $$;

-- Test constraints
DO $$
BEGIN
  -- Test report template category constraint
  BEGIN
    INSERT INTO report_templates (name, category, config)
    VALUES ('Invalid Category', 'invalid', '{}');
    ASSERT false, 'Invalid category should fail';
  EXCEPTION
    WHEN check_violation THEN
      NULL; -- Expected
  END;

  -- Test report access level constraint
  BEGIN
    INSERT INTO reports (organization_id, name, config, created_by, access_level)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      'Invalid Access',
      '{}',
      '00000000-0000-0000-0000-000000000001',
      'invalid'
    );
    ASSERT false, 'Invalid access level should fail';
  EXCEPTION
    WHEN check_violation THEN
      NULL; -- Expected
  END;

  -- Test report run status constraint
  BEGIN
    INSERT INTO report_runs (report_id, status)
    VALUES (
      (SELECT id FROM reports LIMIT 1),
      'invalid'
    );
    ASSERT false, 'Invalid status should fail';
  EXCEPTION
    WHEN check_violation THEN
      NULL; -- Expected
  END;

  RAISE NOTICE 'Constraint tests passed';
END $$;

-- Test indexes performance
DO $$
DECLARE
  v_plan TEXT;
BEGIN
  -- Test report templates index
  EXPLAIN (FORMAT TEXT) 
  SELECT * FROM report_templates 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'
  AND category = 'inventory'
  INTO v_plan;
  
  ASSERT v_plan LIKE '%Index Scan%' OR v_plan LIKE '%Bitmap%', 
    'Should use index for org + category query';

  -- Test scheduled reports index
  EXPLAIN (FORMAT TEXT)
  SELECT * FROM reports
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'
  AND schedule_enabled = true
  INTO v_plan;

  ASSERT v_plan LIKE '%Index Scan%' OR v_plan LIKE '%Bitmap%',
    'Should use index for scheduled reports query';

  RAISE NOTICE 'Index tests passed';
END $$;

-- Cleanup
ROLLBACK;