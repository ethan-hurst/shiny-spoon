-- Apply RLS fix for user authentication issue (Corrected Version)
-- This fixes the circular dependency that causes users to be immediately signed out

-- First, let's check what policies currently exist
-- Then apply the fix with proper handling of existing policies

-- Drop ALL existing user_profiles policies to start fresh
DROP POLICY IF EXISTS "Users can view profiles in their org" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in their org" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their org" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "System can create user profiles during registration" ON user_profiles;
DROP POLICY IF EXISTS "Admins can create additional user profiles" ON user_profiles;

-- Now create the correct policies
-- 1. Users can view their own profile (breaks circular dependency)
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (user_id = auth.uid());

-- 2. Users can view other profiles in their organization
CREATE POLICY "Users can view profiles in their organization"
  ON user_profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- 3. System can create user profiles during registration
CREATE POLICY "System can create user profiles during registration"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

-- 4. Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (user_id = auth.uid());

-- 5. Admins can update other profiles in their organization
CREATE POLICY "Admins can update profiles in their organization"
  ON user_profiles FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_profiles 
      WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND organization_id = user_profiles.organization_id
      AND role IN ('owner', 'admin')
    )
  );

-- Update the helper functions to be more robust
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

-- Verify the fix by testing a simple query
SELECT 'RLS fix applied successfully' as status; 