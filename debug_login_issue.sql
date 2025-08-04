-- Debug the exact issue the login function is encountering
-- This simulates what the signIn function sees

-- 1. Check the exact user data
SELECT 
  'Current User Data' as section,
  id,
  email,
  confirmed_at IS NOT NULL as is_confirmed,
  raw_user_meta_data,
  raw_app_meta_data
FROM auth.users 
WHERE id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d';

-- 2. Simulate the exact query the login function makes
SELECT 
  'Login Function Query Result' as section,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d'
    ) THEN 'Profile EXISTS - should work'
    ELSE 'Profile MISSING - this is the problem'
  END as profile_status;

-- 3. Check if there are any profile records at all
SELECT 
  'All User Profiles' as section,
  user_id,
  organization_id,
  full_name,
  role,
  created_at
FROM public.user_profiles
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check if the specific profile exists with exact match
SELECT 
  'Exact Profile Match' as section,
  user_id,
  organization_id,
  full_name,
  role,
  created_at
FROM public.user_profiles 
WHERE user_id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d';

-- 5. Check if there are any case sensitivity issues
SELECT 
  'Case Sensitivity Check' as section,
  user_id,
  LOWER(user_id::text) as lower_user_id,
  'a46bd1d3-c881-467c-8b6e-b30752cae33d' as expected_id,
  CASE 
    WHEN LOWER(user_id::text) = 'a46bd1d3-c881-467c-8b6e-b30752cae33d' THEN 'MATCH'
    ELSE 'NO MATCH'
  END as id_match
FROM public.user_profiles 
WHERE LOWER(user_id::text) = 'a46bd1d3-c881-467c-8b6e-b30752cae33d'; 