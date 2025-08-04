-- Debug the exact query that the login function makes
-- This will help us understand why the profile check is failing

-- 1. Test the exact query with admin privileges (bypassing RLS)
DO $$
DECLARE
  test_user_id UUID := 'a46bd1d3-c881-467c-8b6e-b30752cae33d';
  profile_count INTEGER;
  profile_data JSONB;
BEGIN
  -- Simulate the exact query from the login function
  SELECT COUNT(*) INTO profile_count
  FROM public.user_profiles 
  WHERE user_id = test_user_id;
  
  RAISE NOTICE 'Profile count (admin query): %', profile_count;
  
  -- Get the actual profile data
  SELECT to_jsonb(up.*) INTO profile_data
  FROM public.user_profiles up
  WHERE up.user_id = test_user_id;
  
  RAISE NOTICE 'Profile data: %', profile_data;
  
  IF profile_count > 0 THEN
    RAISE NOTICE 'SUCCESS: Profile exists and is accessible';
  ELSE
    RAISE NOTICE 'FAILURE: No profile found or accessible';
  END IF;
END $$;

-- 2. Check if there are any issues with the profile data
SELECT 
  'Profile Data Check' as section,
  user_id,
  organization_id,
  full_name,
  role,
  created_at,
  updated_at
FROM public.user_profiles 
WHERE user_id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d';

-- 3. Check if the organization exists and is accessible
SELECT 
  'Organization Check' as section,
  o.id,
  o.name,
  o.slug,
  o.created_at
FROM public.organizations o
JOIN public.user_profiles up ON up.organization_id = o.id
WHERE up.user_id = 'a46bd1d3-c881-467c-8b6e-b30752cae33d';

-- 4. Test the .single() query that the login function uses
DO $$
DECLARE
  test_user_id UUID := 'a46bd1d3-c881-467c-8b6e-b30752cae33d';
  profile_record RECORD;
BEGIN
  -- Try to get a single record (like the login function does)
  SELECT * INTO profile_record
  FROM public.user_profiles 
  WHERE user_id = test_user_id;
  
  IF FOUND THEN
    RAISE NOTICE 'SUCCESS: .single() query would work - profile found';
    RAISE NOTICE 'Profile details: user_id=%, organization_id=%, full_name=%, role=%', 
      profile_record.user_id, profile_record.organization_id, profile_record.full_name, profile_record.role;
  ELSE
    RAISE NOTICE 'FAILURE: .single() query would fail - no profile found';
  END IF;
END $$; 