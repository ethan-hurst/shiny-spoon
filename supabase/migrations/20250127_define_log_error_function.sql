-- Define the log_error function that is used in other migrations
CREATE OR REPLACE FUNCTION log_error(
  p_function_name TEXT,
  p_error_message TEXT,
  p_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_organization_id UUID;
BEGIN
  -- Get current user ID (may be null if called from background process)
  v_user_id := auth.uid();
  
  -- Try to get organization_id if user is authenticated
  IF v_user_id IS NOT NULL THEN
    SELECT organization_id INTO v_organization_id
    FROM user_profiles
    WHERE user_id = v_user_id
    LIMIT 1;
  END IF;
  
  -- Insert error log
  INSERT INTO error_logs (
    function_name,
    error_message,
    error_details,
    user_id,
    organization_id,
    created_at
  ) VALUES (
    p_function_name,
    p_error_message,
    COALESCE(p_details, '{}'::jsonb) || jsonb_build_object(
      'timestamp', NOW(),
      'pg_version', version(),
      'search_path', current_setting('search_path')
    ),
    v_user_id,
    v_organization_id,
    NOW()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- If we can't log the error, at least raise a notice
    RAISE NOTICE 'Failed to log error: % - Original error: % in %', 
      SQLERRM, p_error_message, p_function_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_error TO authenticated;

-- Also create the error_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_organization_id ON error_logs(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON error_logs(created_at DESC) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view error logs from their organization
CREATE POLICY "Users can view own organization error logs" ON error_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- System admins can view all error logs
CREATE POLICY "System admins can view all error logs" ON error_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'system_admin'
    )
  );

-- Users can update error logs from their organization (for resolution)
CREATE POLICY "Users can resolve own organization error logs" ON error_logs
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON FUNCTION log_error IS 'Centralized error logging function used across the application for consistent error tracking';
COMMENT ON TABLE error_logs IS 'Stores application errors for debugging and monitoring purposes';