-- Test the organization functions that RLS policies depend on
-- This will show us why the SELECT query is failing

-- 1. Check if the functions exist
SELECT 
  'Function Check' as section,
  proname,
  prosrc IS NOT NULL as exists
FROM pg_proc 
WHERE proname IN ('get_user_organization_id', 'is_org_admin');

-- 2. Test the get_user_organization_id function
DO $$
DECLARE
  test_user_id UUID := 'a46bd1d3-c881-467c-8b6e-b30752cae33d';
  org_id UUID;
BEGIN
  -- Test the function directly
  SELECT get_user_organization_id(test_user_id) INTO org_id;
  
  RAISE NOTICE 'User organization ID: %', org_id;
  
  IF org_id IS NULL THEN
    RAISE NOTICE 'PROBLEM: get_user_organization_id returns NULL';
  ELSE
    RAISE NOTICE 'SUCCESS: get_user_organization_id returns: %', org_id;
  END IF;
END $$;

-- 3. Test the is_org_admin function
DO $$
DECLARE
  test_user_id UUID := 'a46bd1d3-c881-467c-8b6e-b30752cae33d';
  is_admin BOOLEAN;
  org_id UUID;
BEGIN
  -- Get the organization ID first
  SELECT get_user_organization_id(test_user_id) INTO org_id;
  
  -- Test the admin function
  SELECT is_org_admin(test_user_id, org_id) INTO is_admin;
  
  RAISE NOTICE 'User is admin: %', is_admin;
  RAISE NOTICE 'Organization ID: %', org_id;
END $$;

-- 4. Check what the RLS policy would see
SELECT 
  'RLS Policy Test' as section,
  up.user_id,
  up.organization_id,
  get_user_organization_id(up.user_id) as policy_org_id,
  CASE 
    WHEN up.organization_id = get_user_organization_id(up.user_id) THEN 'MATCH'
    ELSE 'NO MATCH'
  END as policy_match
FROM public.user_profiles up
WHERE up.user_id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d'; 