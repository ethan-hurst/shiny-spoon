-- Check RLS policies that might be blocking the user profile query
-- This is likely the issue since the profile exists but the query fails

-- 1. Check if RLS is enabled on user_profiles
SELECT 
  'RLS Status' as section,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_profiles';

-- 2. Check RLS policies on user_profiles
SELECT 
  'RLS Policies' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 3. Test the exact query with current user context
-- This simulates what the application sees
DO $$
DECLARE
  test_user_id UUID := 'a46bd1d3-c881-467c-8b6e-b30752cae33d';
  test_user_id_text TEXT;
  profile_count INTEGER;
BEGIN
  -- Convert UUID to text for the JWT claim
  test_user_id_text := test_user_id::text;
  
  -- Set the current user context (this is what Supabase does)
  SET LOCAL "request.jwt.claim.sub" = test_user_id_text;
  SET LOCAL "request.jwt.claim.email" = 'ethan.hurst@outlook.com.au';
  
  -- Try the exact query the application makes
  SELECT COUNT(*) INTO profile_count
  FROM public.user_profiles 
  WHERE user_id = test_user_id;
  
  RAISE NOTICE 'Profile count with RLS: %', profile_count;
  
  IF profile_count > 0 THEN
    RAISE NOTICE 'SUCCESS: RLS allows the query';
  ELSE
    RAISE NOTICE 'FAILURE: RLS is blocking the query';
  END IF;
END $$;

-- 4. Check if there are any organization-based RLS policies
SELECT 
  'Organization RLS' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'user_profiles' 
  AND qual LIKE '%organization_id%';

-- 5. Show the current RLS policies in detail
SELECT 
  'Policy Details' as section,
  p.policyname,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_policies p
WHERE p.tablename = 'user_profiles'; 