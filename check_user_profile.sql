-- Check the current state of your user profile
-- User ID: a46bd1d3-c881-467c-8b6e-b30752cae33d

-- 1. Check if user exists in auth.users
SELECT 
  'Auth User' as check_type,
  id,
  email,
  confirmed_at IS NOT NULL as is_confirmed,
  raw_user_meta_data
FROM auth.users 
WHERE id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d';

-- 2. Check if user_profiles exists for this user
SELECT 
  'User Profile' as check_type,
  user_id,
  organization_id,
  full_name,
  role,
  created_at
FROM public.user_profiles 
WHERE user_id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d';

-- 3. Check the organization
SELECT 
  'Organization' as check_type,
  o.id,
  o.name,
  o.slug,
  o.created_at
FROM public.organizations o
JOIN public.user_profiles up ON up.organization_id = o.id
WHERE up.user_id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d';

-- 4. Check if there are any issues with the profile
SELECT 
  'Profile Issues' as check_type,
  CASE 
    WHEN up.user_id IS NULL THEN 'No user profile found'
    WHEN up.organization_id IS NULL THEN 'No organization assigned'
    WHEN up.full_name IS NULL THEN 'No full name set'
    WHEN up.role IS NULL THEN 'No role assigned'
    ELSE 'Profile looks good'
  END as issue_status
FROM public.user_profiles up
WHERE up.user_id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d'; 