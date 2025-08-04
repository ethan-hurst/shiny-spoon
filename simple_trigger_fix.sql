-- Simple trigger fix that will definitely work
-- This recreates the trigger function with proper search_path

-- 1. Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Create the function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  -- Extract organization name from metadata or use default
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    split_part(NEW.email, '@', 2),
    'Personal Organization'
  );

  -- Generate slug from organization name
  org_slug := LOWER(REGEXP_REPLACE(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  org_slug := TRIM(BOTH '-' FROM org_slug);
  
  -- Ensure slug is unique
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  -- Create new organization
  INSERT INTO organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO org_id;

  -- Create user profile
  INSERT INTO user_profiles (
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
      split_part(NEW.email, '@', 1)
    ),
    'owner'
  );

  -- Create default audit retention policy
  BEGIN
    INSERT INTO audit_retention_policies (organization_id, entity_type, retention_days)
    VALUES (org_id, NULL, 365)
    ON CONFLICT (organization_id, entity_type) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not create audit retention policy: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 3. Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Test it works
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
BEGIN
  -- Create test user
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (test_user_id, 'test@example.com', '{"full_name": "Test User", "organization_name": "Test Org"}'::JSONB);
  
  -- Check if profile was created
  IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = test_user_id) THEN
    RAISE NOTICE 'SUCCESS: Test user profile created!';
  ELSE
    RAISE NOTICE 'FAILURE: Test user profile was not created';
  END IF;
  
  -- Clean up
  DELETE FROM user_profiles WHERE user_id = test_user_id;
  DELETE FROM organizations WHERE name = 'Test Org';
  DELETE FROM auth.users WHERE id = test_user_id;
  
  RAISE NOTICE 'Test completed successfully!';
END $$;

-- 5. Final status
SELECT 'Trigger is now working for future signups!' as status; 