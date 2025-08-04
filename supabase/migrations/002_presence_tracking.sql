-- Presence tracking table
CREATE TABLE IF NOT EXISTS presence_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  resource_type TEXT NOT NULL, -- 'inventory_list', 'inventory_item', 'customer', etc.
  resource_id TEXT, -- Optional: specific item ID
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}', -- Additional data like cursor position, etc.
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for queries
CREATE INDEX idx_presence_org_resource ON presence_status(organization_id, resource_type, resource_id);
CREATE INDEX idx_presence_last_seen ON presence_status(last_seen);
CREATE INDEX idx_presence_user ON presence_status(user_id);

-- RLS Policies
ALTER TABLE presence_status ENABLE ROW LEVEL SECURITY;

-- Users can view presence in their organization
CREATE POLICY "Users can view organization presence" ON presence_status
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own presence
CREATE POLICY "Users can insert own presence" ON presence_status
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    organization_id = (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Users can update their own presence
CREATE POLICY "Users can update own presence" ON presence_status
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own presence
CREATE POLICY "Users can delete own presence" ON presence_status
  FOR DELETE USING (user_id = auth.uid());

-- Auto-cleanup old presence function
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM presence_status
  WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create an index to speed up the cleanup (removed NOW() from WHERE clause)
CREATE INDEX idx_presence_cleanup ON presence_status(last_seen);

-- Optional: Set up periodic cleanup with pg_cron (requires extension)
-- This would need to be run by a superuser after enabling pg_cron:
-- SELECT cron.schedule('cleanup-presence', '*/5 * * * *', 'SELECT cleanup_old_presence()');

-- Alternative: Create a trigger to cleanup on insert (less efficient but works without pg_cron)
CREATE OR REPLACE FUNCTION trigger_cleanup_old_presence()
RETURNS TRIGGER AS $$
BEGIN
  -- Randomly cleanup (1% chance) to avoid doing it on every insert
  IF random() < 0.01 THEN
    PERFORM cleanup_old_presence();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_presence_trigger
AFTER INSERT ON presence_status
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_cleanup_old_presence();

-- Function to get active users for a resource
CREATE OR REPLACE FUNCTION get_active_presence(
  p_organization_id UUID,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  status TEXT,
  metadata JSONB,
  last_seen TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.user_id,
    u.email as user_email,
    up.full_name,
    up.avatar_url,
    ps.status,
    ps.metadata,
    ps.last_seen
  FROM presence_status ps
  JOIN auth.users u ON u.id = ps.user_id
  LEFT JOIN user_profiles up ON up.user_id = ps.user_id
  WHERE 
    ps.organization_id = p_organization_id
    AND ps.resource_type = p_resource_type
    AND (p_resource_id IS NULL OR ps.resource_id = p_resource_id)
    AND ps.last_seen > NOW() - INTERVAL '5 minutes'
  ORDER BY ps.last_seen DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_active_presence TO authenticated;