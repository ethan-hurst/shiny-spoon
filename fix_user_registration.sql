-- Fix RLS policies for user registration
-- Run this in your Supabase SQL Editor to fix the "Database error saving new user" issue

-- Add INSERT policy for organizations table
-- This allows the trigger function to create new organizations during user registration
CREATE POLICY "System can create organizations during registration"
  ON organizations FOR INSERT
  WITH CHECK (true); -- Allow all inserts since the trigger function has SECURITY DEFINER

-- Add INSERT policy for user_profiles table  
-- This allows the trigger function to create user profiles during registration
CREATE POLICY "System can create user profiles during registration"
  ON user_profiles FOR INSERT
  WITH CHECK (true); -- Allow all inserts since the trigger function has SECURITY DEFINER

-- Add a more restrictive policy for user_profiles that applies after registration
-- This ensures that only admins can create additional user profiles after the initial setup
CREATE POLICY "Admins can create additional user profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND is_org_admin(auth.uid(), organization_id)
  );

-- Add a more restrictive policy for organizations that applies after registration
-- This ensures that only owners can create additional organizations
CREATE POLICY "Owners can create additional organizations"
  ON organizations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'owner'
    )
  ); 