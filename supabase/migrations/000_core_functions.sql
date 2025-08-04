-- Core Functions Migration
-- This migration consolidates all core helper functions and removes duplications
-- Should be run first before any other migrations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- STANDARDIZED HELPER FUNCTIONS
-- =============================================

-- Standardized update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's organization ID (will be updated after tables exist)
CREATE OR REPLACE FUNCTION get_user_organization_id(user_uuid UUID)
RETURNS UUID AS $$
BEGIN
  -- This function will be updated after user_profiles table exists
  -- For now, return NULL to prevent errors
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is org member (will be updated after tables exist)
CREATE OR REPLACE FUNCTION is_org_member(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- This function will be updated after user_profiles table exists
  -- For now, return false to prevent errors
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is org admin (will be updated after tables exist)
CREATE OR REPLACE FUNCTION is_org_admin(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- This function will be updated after user_profiles table exists
  -- For now, return false to prevent errors
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup (will be updated after tables exist)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- This function will be updated after organizations and user_profiles tables exist
  -- For now, just return NEW to prevent errors
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create audit log entries (will be updated after tables exist)
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
BEGIN
  -- This function will be updated after audit_logs table exists
  -- For now, return a dummy UUID to prevent errors
  RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old audit logs (will be updated after tables exist)
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void AS $$
BEGIN
  -- This function will be updated after audit_logs and audit_retention_policies tables exist
  -- For now, do nothing to prevent errors
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log errors (will be updated after tables exist)
CREATE OR REPLACE FUNCTION log_error(
  p_error_message TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_stack_trace TEXT DEFAULT NULL,
  p_context JSONB DEFAULT '{}',
  p_organization_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
BEGIN
  -- This function will be updated after error_logs table exists
  -- For now, return a dummy UUID to prevent errors
  RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organization_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_audit_log(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, JSONB, JSONB, INET, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_audit_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION log_error(TEXT, TEXT, TEXT, JSONB, UUID, UUID) TO service_role;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON FUNCTION update_updated_at_column() IS 'Standardized function to update updated_at timestamp on any table';
COMMENT ON FUNCTION get_user_organization_id(UUID) IS 'Get the organization ID for a given user (placeholder until tables exist)';
COMMENT ON FUNCTION is_org_member(UUID, UUID) IS 'Check if user is a member of the specified organization (placeholder until tables exist)';
COMMENT ON FUNCTION is_org_admin(UUID, UUID) IS 'Check if user is an admin of the specified organization (placeholder until tables exist)';
COMMENT ON FUNCTION handle_new_user() IS 'Handle new user signup and organization creation (placeholder until tables exist)';
COMMENT ON FUNCTION create_audit_log(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, JSONB, JSONB, INET, TEXT, UUID) IS 'Create standardized audit log entries (placeholder until tables exist)';
COMMENT ON FUNCTION cleanup_audit_logs() IS 'Clean up old audit logs based on retention policies (placeholder until tables exist)';
COMMENT ON FUNCTION log_error(TEXT, TEXT, TEXT, JSONB, UUID, UUID) IS 'Log errors with context for debugging (placeholder until tables exist)'; 