-- Test AI-Powered Insights Database Schema (PRP-021)

BEGIN;

-- Test ai_predictions table
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_prediction_id UUID;
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

  -- Test creating a demand prediction
  INSERT INTO ai_predictions (
    organization_id,
    prediction_type,
    entity_type,
    entity_id,
    prediction_date,
    prediction_value,
    confidence_score,
    model_version,
    prediction_start,
    prediction_end
  ) VALUES (
    v_org_id,
    'demand',
    'product',
    gen_random_uuid(),
    CURRENT_DATE,
    '{"forecast": [10, 12, 15, 14, 13], "horizonDays": 5}'::JSONB,
    0.85,
    '1.0.0',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '5 days'
  ) RETURNING id INTO v_prediction_id;

  -- Test RLS: User can view their own predictions
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims.sub TO v_user_id::TEXT;

  ASSERT EXISTS (
    SELECT 1 FROM ai_predictions WHERE id = v_prediction_id
  ), 'User should be able to view their own predictions';

  -- Test unique constraint
  BEGIN
    INSERT INTO ai_predictions (
      organization_id,
      prediction_type,
      entity_type,
      entity_id,
      prediction_date,
      prediction_value,
      confidence_score,
      model_version,
      prediction_start,
      prediction_end
    ) VALUES (
      v_org_id,
      'demand',
      'product',
      (SELECT entity_id FROM ai_predictions WHERE id = v_prediction_id),
      CURRENT_DATE,
      '{"forecast": [11, 13, 16]}'::JSONB,
      0.90,
      '1.0.0',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '3 days'
    );
    
    RAISE EXCEPTION 'Should not allow duplicate predictions';
  EXCEPTION
    WHEN unique_violation THEN
      NULL; -- Expected
  END;

  -- Test confidence score constraint
  BEGIN
    INSERT INTO ai_predictions (
      organization_id,
      prediction_type,
      entity_type,
      entity_id,
      prediction_date,
      prediction_value,
      confidence_score,
      model_version,
      prediction_start,
      prediction_end
    ) VALUES (
      v_org_id,
      'price',
      'product',
      gen_random_uuid(),
      CURRENT_DATE,
      '{"suggestedPrice": 99.99}'::JSONB,
      1.5, -- Invalid confidence > 1
      '1.0.0',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '7 days'
    );
    
    RAISE EXCEPTION 'Should not allow confidence score > 1';
  EXCEPTION
    WHEN check_violation THEN
      NULL; -- Expected
  END;

  RAISE NOTICE 'AI predictions tests passed';
END $$;

-- Test ai_insights table
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_insight_id UUID;
BEGIN
  -- Get test data
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'test-org';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'test@example.com';

  -- Test creating an insight
  INSERT INTO ai_insights (
    organization_id,
    insight_type,
    title,
    content,
    severity,
    related_entities,
    recommended_actions
  ) VALUES (
    v_org_id,
    'alert',
    'Low Stock Alert',
    'Product XYZ is running low on stock',
    'warning',
    '[{"type": "product", "id": "123", "name": "Product XYZ"}]'::JSONB,
    '["Reorder immediately", "Check supplier availability"]'::JSONB
  ) RETURNING id INTO v_insight_id;

  -- Test RLS: User can view their insights
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims.sub TO v_user_id::TEXT;

  ASSERT EXISTS (
    SELECT 1 FROM ai_insights WHERE id = v_insight_id
  ), 'User should be able to view their own insights';

  -- Test updating insight (mark as read)
  UPDATE ai_insights 
  SET is_read = true 
  WHERE id = v_insight_id;

  ASSERT (
    SELECT is_read FROM ai_insights WHERE id = v_insight_id
  ) = true, 'User should be able to update their insights';

  -- Test insight type constraint
  BEGIN
    INSERT INTO ai_insights (
      organization_id,
      insight_type,
      title,
      content
    ) VALUES (
      v_org_id,
      'invalid_type',
      'Test',
      'Test content'
    );
    
    RAISE EXCEPTION 'Should not allow invalid insight type';
  EXCEPTION
    WHEN check_violation THEN
      NULL; -- Expected
  END;

  -- Test severity constraint
  BEGIN
    INSERT INTO ai_insights (
      organization_id,
      insight_type,
      title,
      content,
      severity
    ) VALUES (
      v_org_id,
      'alert',
      'Test',
      'Test content',
      'extreme' -- Invalid severity
    );
    
    RAISE EXCEPTION 'Should not allow invalid severity';
  EXCEPTION
    WHEN check_violation THEN
      NULL; -- Expected
  END;

  RAISE NOTICE 'AI insights tests passed';
END $$;

-- Test ml_training_data table
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_training_id UUID;
BEGIN
  -- Get test data
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'test-org';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'test@example.com';

  -- Test creating training data
  INSERT INTO ml_training_data (
    organization_id,
    model_type,
    data,
    feature_names,
    metrics
  ) VALUES (
    v_org_id,
    'demand_forecast',
    '{"samples": [[1,2,3], [4,5,6]], "labels": [10, 20]}'::JSONB,
    ARRAY['feature1', 'feature2', 'feature3'],
    '{"mae": 0.15, "rmse": 0.22, "r2": 0.89}'::JSONB
  ) RETURNING id INTO v_training_id;

  -- Test RLS: Users cannot directly access training data
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims.sub TO v_user_id::TEXT;

  -- Training data should have restricted access (only service role)
  -- This test verifies no RLS policy exists for regular users
  ASSERT NOT EXISTS (
    SELECT 1 FROM ml_training_data WHERE id = v_training_id
  ), 'Regular users should not access ML training data directly';

  RESET ROLE;

  -- Service role should be able to access
  ASSERT EXISTS (
    SELECT 1 FROM ml_training_data WHERE id = v_training_id
  ), 'Service role should access ML training data';

  RAISE NOTICE 'ML training data tests passed';
END $$;

-- Test indexes performance
DO $$
DECLARE
  v_org_id UUID;
  v_query_plan TEXT;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'test-org';

  -- Test ai_predictions lookup index
  EXPLAIN (FORMAT TEXT) 
  SELECT * FROM ai_predictions 
  WHERE organization_id = v_org_id 
    AND entity_type = 'product' 
    AND entity_id = gen_random_uuid()
    AND prediction_type = 'demand'
  INTO v_query_plan;

  ASSERT v_query_plan LIKE '%Index Scan%idx_ai_predictions_lookup%', 
    'Should use lookup index for predictions';

  -- Test ai_insights unread index
  EXPLAIN (FORMAT TEXT)
  SELECT * FROM ai_insights
  WHERE organization_id = v_org_id
    AND is_read = false
  INTO v_query_plan;

  ASSERT v_query_plan LIKE '%Index%idx_ai_insights_unread%',
    'Should use unread index for insights';

  RAISE NOTICE 'Index performance tests passed';
END $$;

-- Test cleanup function
DO $$
DECLARE
  v_org_id UUID;
  v_expired_id UUID;
  v_active_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'test-org';

  -- Create expired prediction
  INSERT INTO ai_predictions (
    organization_id,
    prediction_type,
    entity_type,
    entity_id,
    prediction_date,
    prediction_value,
    confidence_score,
    model_version,
    prediction_start,
    prediction_end,
    expires_at
  ) VALUES (
    v_org_id,
    'demand',
    'product',
    gen_random_uuid(),
    CURRENT_DATE - INTERVAL '10 days',
    '{}'::JSONB,
    0.8,
    '1.0.0',
    CURRENT_DATE - INTERVAL '10 days',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day' -- Expired yesterday
  ) RETURNING id INTO v_expired_id;

  -- Create active prediction
  INSERT INTO ai_predictions (
    organization_id,
    prediction_type,
    entity_type,
    entity_id,
    prediction_date,
    prediction_value,
    confidence_score,
    model_version,
    prediction_start,
    prediction_end,
    expires_at
  ) VALUES (
    v_org_id,
    'demand',
    'product',
    gen_random_uuid(),
    CURRENT_DATE,
    '{}'::JSONB,
    0.8,
    '1.0.0',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '5 days',
    CURRENT_TIMESTAMP + INTERVAL '7 days' -- Expires in future
  ) RETURNING id INTO v_active_id;

  -- Run cleanup
  PERFORM cleanup_expired_predictions();

  -- Verify expired prediction is deleted
  ASSERT NOT EXISTS (
    SELECT 1 FROM ai_predictions WHERE id = v_expired_id
  ), 'Expired prediction should be deleted';

  -- Verify active prediction remains
  ASSERT EXISTS (
    SELECT 1 FROM ai_predictions WHERE id = v_active_id
  ), 'Active prediction should remain';

  RAISE NOTICE 'Cleanup function tests passed';
END $$;

-- Cleanup
ROLLBACK;