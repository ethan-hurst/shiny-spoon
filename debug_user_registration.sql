-- Debug and fix user registration trigger
-- Run these commands one by one in Supabase SQL Editor

-- 1. Check what tables exist
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename IN ('organizations', 'user_profiles')
ORDER BY tablename;

-- 2. Check if trigger function exists
SELECT proname, pronamespace::regnamespace 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 3. Check if trigger exists
SELECT tgname, tgrelid::regclass, tgfoid::regproc
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 4. Check table structure
\d organizations;
\d user_profiles;

-- 5. If the function doesn't exist, recreate it with explicit schema references
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  -- Extract organization name from metadata or use default
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    split_part(NEW.email, '@', 2), -- Use domain as org name
    'Personal Organization'
  );

  -- Generate slug from organization name
  org_slug := LOWER(REGEXP_REPLACE(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  
  -- Remove leading/trailing hyphens
  org_slug := TRIM(BOTH '-' FROM org_slug);
  
  -- Ensure slug is unique by appending random suffix if needed
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  -- Try to get invited organization ID from metadata
  IF NEW.raw_user_meta_data->>'invited_organization_id' IS NOT NULL THEN
    org_id := (NEW.raw_user_meta_data->>'invited_organization_id')::UUID;
  ELSE
    -- Create new organization with explicit schema reference
    INSERT INTO public.organizations (name, slug)
    VALUES (org_name, org_slug)
    RETURNING id INTO org_id;
  END IF;

  -- Create user profile with explicit schema reference
  INSERT INTO public.user_profiles (
    user_id, 
    organization_id, 
    full_name, 
    role
  ) VALUES (
    NEW.id,
    org_id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_app_meta_data->>'full_name',
      split_part(NEW.email, '@', 1) -- Use email prefix as name
    ),
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE organization_id = org_id
      ) THEN 'owner' -- First user is owner
      ELSE 'member' -- Subsequent users are members
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 6. Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 7. Test that we can query the tables
SELECT 'organizations table:' as info, count(*) as row_count FROM public.organizations
UNION ALL
SELECT 'user_profiles table:' as info, count(*) as row_count FROM public.user_profiles;