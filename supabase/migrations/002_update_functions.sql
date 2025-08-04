-- Update Functions Migration
-- This migration updates the placeholder functions with proper table references
-- Should be run after 001_core_schema.sql

-- =============================================
-- UPDATE FUNCTIONS WITH PROPER TABLE REFERENCES
-- =============================================

-- Update get_user_organization_id function
CREATE OR REPLACE FUNCTION get_user_organization_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT organization_id FROM user_profiles WHERE user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Update is_org_member function
CREATE OR REPLACE FUNCTION is_org_member(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = user_uuid 
    AND organization_id = org_uuid
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Update is_org_admin function
CREATE OR REPLACE FUNCTION is_org_admin(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = user_uuid 
    AND organization_id = org_uuid 
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_audit_log function
CREATE OR REPLACE FUNCTION create_audit_log(
  p_organization_id UUID,
  p_user_id UUID,
  p_user_email TEXT,
  p_user_role TEXT,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    organization_id,
    user_id,
    user_email,
    user_role,
    action,
    entity_type,
    entity_id,
    entity_name,
    old_values,
    new_values,
    metadata,
    ip_address,
    user_agent,
    request_id
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_user_email,
    p_user_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_old_values,
    p_new_values,
    p_metadata,
    p_ip_address,
    p_user_agent,
    p_request_id
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update cleanup_audit_logs function
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs al
  WHERE EXISTS (
    SELECT 1 FROM audit_retention_policies arp
    WHERE arp.organization_id = al.organization_id
    AND (arp.entity_type = al.entity_type OR arp.entity_type IS NULL)
    AND arp.is_active = true
    AND al.created_at < NOW() - (arp.retention_days || ' days')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update log_error function
CREATE OR REPLACE FUNCTION log_error(
  p_error_message TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_stack_trace TEXT DEFAULT NULL,
  p_context JSONB DEFAULT '{}',
  p_organization_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO error_logs (
    error_message,
    error_code,
    stack_trace,
    context,
    organization_id,
    user_id
  ) VALUES (
    p_error_message,
    p_error_code,
    p_stack_trace,
    p_context,
    p_organization_id,
    p_user_id
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- UPDATE COMMENTS
-- =============================================

COMMENT ON FUNCTION get_user_organization_id(UUID) IS 'Get the organization ID for a given user';
COMMENT ON FUNCTION is_org_member(UUID, UUID) IS 'Check if user is a member of the specified organization';
COMMENT ON FUNCTION is_org_admin(UUID, UUID) IS 'Check if user is an admin of the specified organization';
COMMENT ON FUNCTION handle_new_user() IS 'Handle new user signup and organization creation';
COMMENT ON FUNCTION create_audit_log(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, JSONB, JSONB, INET, TEXT, UUID) IS 'Create standardized audit log entries';
COMMENT ON FUNCTION cleanup_audit_logs() IS 'Clean up old audit logs based on retention policies';
COMMENT ON FUNCTION log_error(TEXT, TEXT, TEXT, JSONB, UUID, UUID) IS 'Log errors with context for debugging'; 