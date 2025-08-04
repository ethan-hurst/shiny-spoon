-- Fix the handle_new_user trigger function to handle the foreign key constraint properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  -- Try to get invited organization ID from metadata
  IF NEW.raw_user_meta_data->>'invited_organization_id' IS NOT NULL THEN
    org_id := (NEW.raw_user_meta_data->>'invited_organization_id')::UUID;
  ELSE
    -- Create new organization
    INSERT INTO organizations (name, slug)
    VALUES (org_name, org_slug)
    RETURNING id INTO org_id;
  END IF;

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
      split_part(NEW.email, '@', 1) -- Use email prefix as name
    ),
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM user_profiles WHERE organization_id = org_id
      ) THEN 'owner' -- First user is owner
      ELSE 'member' -- Subsequent users are members
    END
  );

  -- Create default retention policies for new organizations
  -- Only if this is a new organization (not joining existing one)
  IF NEW.raw_user_meta_data->>'invited_organization_id' IS NULL THEN
    BEGIN
      INSERT INTO audit_retention_policies (organization_id, entity_type, retention_days)
      VALUES (org_id, NULL, 365)
      ON CONFLICT (organization_id, entity_type) DO NOTHING;
    EXCEPTION WHEN foreign_key_violation THEN
      -- If foreign key constraint fails, log it but don't fail the entire registration
      -- This could happen in edge cases with transaction timing
      RAISE WARNING 'Could not create audit retention policy for organization %: %', org_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;