-- Organization invites table for multi-tenant onboarding (PRP-024)

CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(6) UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('admin', 'member', 'viewer')) DEFAULT 'member',
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  used_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER DEFAULT 1,
  uses_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX idx_organization_invites_code ON organization_invites(code) WHERE is_active = true;
CREATE INDEX idx_organization_invites_org ON organization_invites(organization_id);
CREATE INDEX idx_organization_invites_expires ON organization_invites(expires_at) WHERE is_active = true;

-- RLS policies
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Only organization admins and owners can view invites
CREATE POLICY "Organization admins can view invites" ON organization_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND organization_id = organization_invites.organization_id
      AND role IN ('admin', 'owner')
    )
  );

-- Only organization admins and owners can create invites
CREATE POLICY "Organization admins can create invites" ON organization_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND organization_id = organization_invites.organization_id
      AND role IN ('admin', 'owner')
    )
  );

-- Only organization admins and owners can update invites
CREATE POLICY "Organization admins can update invites" ON organization_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND organization_id = organization_invites.organization_id
      AND role IN ('admin', 'owner')
    )
  );

-- Anyone can use an invite code (public access for joining)
CREATE POLICY "Public can use invite codes" ON organization_invites
  FOR SELECT USING (
    code IS NOT NULL 
    AND is_active = true 
    AND expires_at > NOW()
  );

-- Function to clean up expired invites
CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS void AS $$
BEGIN
  UPDATE organization_invites
  SET is_active = false
  WHERE is_active = true
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add owner role to user profiles enum
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('owner', 'admin', 'member', 'viewer'));