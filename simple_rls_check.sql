-- Simple RLS check to see what's blocking the user profile query

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

-- 3. Check if there are any organization-based RLS policies
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

-- 4. Show the current RLS policies in detail
SELECT 
  'Policy Details' as section,
  p.policyname,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_policies p
WHERE p.tablename = 'user_profiles';

-- 5. Test a simple query to see if RLS is blocking
SELECT 
  'Direct Query Test' as section,
  COUNT(*) as profile_count,
  CASE 
    WHEN COUNT(*) > 0 THEN 'SUCCESS: Query works'
    ELSE 'FAILURE: Query blocked by RLS'
  END as query_status
FROM public.user_profiles 
WHERE user_id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d'; 