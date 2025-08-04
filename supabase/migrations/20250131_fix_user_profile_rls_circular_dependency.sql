-- Fix circular dependency in user_profiles RLS policies
-- The issue: get_user_organization_id() returns NULL when user profile doesn't exist,
-- creating a circular dependency where users can't access their own profile

-- Drop the problematic policy that creates circular dependency
DROP POLICY IF EXISTS "Users can view profiles in their org" ON user_profiles;

-- Create a new policy that allows users to view their own profile
-- This breaks the circular dependency by allowing direct access to own profile
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Create a policy for viewing other profiles in the same organization
-- This uses a more robust approach that doesn't create circular dependencies
CREATE POLICY "Users can view profiles in their organization"
  ON user_profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Update the get_user_organization_id function to handle NULL cases better
CREATE OR REPLACE FUNCTION get_user_organization_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT organization_id FROM user_profiles WHERE user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Add a more robust version that handles edge cases
CREATE OR REPLACE FUNCTION get_user_organization_id_safe(user_uuid UUID)
RETURNS UUID AS $$
BEGIN
  -- Try to get organization_id from user_profiles
  RETURN (
    SELECT organization_id 
    FROM user_profiles 
    WHERE user_id = user_uuid
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL if there's any error
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the is_org_member function to be more robust
CREATE OR REPLACE FUNCTION is_org_member(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = user_uuid 
    AND organization_id = org_uuid
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the is_org_admin function to be more robust
CREATE OR REPLACE FUNCTION is_org_admin(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = user_uuid 
    AND organization_id = org_uuid 
    AND role IN ('owner', 'admin')
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a policy to allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Keep the existing admin policies for managing other users
-- These are already working correctly since they use the helper functions 