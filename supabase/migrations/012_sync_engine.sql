-- PRP-015: Sync Engine Core Database Schema

-- Sync jobs table for tracking all sync operations
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  integration_id UUID REFERENCES integrations(id) NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('manual', 'scheduled', 'webhook', 'retry')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  config JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  progress JSONB,
  result JSONB,
  error JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Indexes for performance
  CONSTRAINT sync_jobs_duration_check CHECK (duration_ms >= 0)
);

-- Create indexes for sync jobs
CREATE INDEX idx_sync_jobs_organization ON sync_jobs(organization_id);
CREATE INDEX idx_sync_jobs_integration ON sync_jobs(integration_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_created_at ON sync_jobs(created_at DESC);
CREATE INDEX idx_sync_jobs_status_created ON sync_jobs(status, created_at DESC);

-- Sync state table for tracking sync cursors and metadata
CREATE TABLE IF NOT EXISTS sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('products', 'inventory', 'pricing', 'customers', 'orders')),
  last_sync_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  last_cursor TEXT,
  sync_version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint on integration and entity type
  CONSTRAINT sync_state_unique UNIQUE(integration_id, entity_type)
);

-- Create indexes for sync state
CREATE INDEX idx_sync_state_integration ON sync_state(integration_id);
CREATE INDEX idx_sync_state_entity_type ON sync_state(entity_type);

-- Sync schedules table for managing recurring sync jobs
CREATE TABLE IF NOT EXISTS sync_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL CHECK (frequency IN ('every_5_min', 'every_15_min', 'every_30_min', 'hourly', 'daily', 'weekly')),
  timezone TEXT DEFAULT 'UTC',
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  hour INTEGER CHECK (hour >= 0 AND hour <= 23),
  minute INTEGER CHECK (minute >= 0 AND minute <= 59),
  entity_types TEXT[] NOT NULL,
  active_hours JSONB,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for finding schedules to run
CREATE INDEX idx_sync_schedules_next_run ON sync_schedules(next_run_at) WHERE enabled = true;
CREATE INDEX idx_sync_schedules_integration ON sync_schedules(integration_id);

-- Sync conflicts table for tracking data conflicts
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID REFERENCES sync_jobs(id) NOT NULL,
  entity_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  field TEXT NOT NULL,
  source_value JSONB,
  target_value JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolution_strategy TEXT CHECK (resolution_strategy IN ('source_wins', 'target_wins', 'newest_wins', 'manual')),
  resolved_value JSONB,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT sync_conflicts_resolution_check CHECK (
    (resolved_at IS NULL AND resolved_by IS NULL AND resolved_value IS NULL) OR
    (resolved_at IS NOT NULL AND resolved_by IS NOT NULL AND resolved_value IS NOT NULL)
  )
);

-- Create indexes for sync conflicts
CREATE INDEX idx_sync_conflicts_job ON sync_conflicts(sync_job_id);
CREATE INDEX idx_sync_conflicts_unresolved ON sync_conflicts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_sync_conflicts_entity ON sync_conflicts(entity_type, record_id);

-- Sync queue table for job processing
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES sync_jobs(id) NOT NULL UNIQUE,
  priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for queue processing
  CONSTRAINT sync_queue_attempts_check CHECK (attempts >= 0 AND attempts <= max_attempts)
);

-- Create indexes for efficient queue processing
CREATE INDEX idx_sync_queue_next_attempt ON sync_queue(next_attempt_at, priority DESC) 
  WHERE locked_by IS NULL;
CREATE INDEX idx_sync_queue_locked ON sync_queue(locked_by, locked_at) 
  WHERE locked_by IS NOT NULL;

-- Sync metrics table for performance tracking
CREATE TABLE IF NOT EXISTS sync_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID REFERENCES sync_jobs(id) NOT NULL,
  api_calls INTEGER DEFAULT 0,
  api_call_duration_ms INTEGER DEFAULT 0,
  db_queries INTEGER DEFAULT 0,
  db_query_duration_ms INTEGER DEFAULT 0,
  memory_used_mb INTEGER,
  cpu_usage_percent INTEGER,
  network_bytes_sent BIGINT DEFAULT 0,
  network_bytes_received BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT sync_metrics_positive_check CHECK (
    api_calls >= 0 AND 
    api_call_duration_ms >= 0 AND 
    db_queries >= 0 AND 
    db_query_duration_ms >= 0 AND
    network_bytes_sent >= 0 AND
    network_bytes_received >= 0
  )
);

-- Create index for metrics lookup
CREATE INDEX idx_sync_metrics_job ON sync_metrics(sync_job_id);

-- Sync notifications table
CREATE TABLE IF NOT EXISTS sync_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  sync_job_id UUID REFERENCES sync_jobs(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sync_started', 'sync_completed', 'sync_failed', 
    'conflicts_detected', 'performance_degradation', 'quota_exceeded'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'webhook')),
  recipient TEXT NOT NULL,
  payload JSONB NOT NULL,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for notifications
CREATE INDEX idx_sync_notifications_org ON sync_notifications(organization_id);
CREATE INDEX idx_sync_notifications_job ON sync_notifications(sync_job_id);
CREATE INDEX idx_sync_notifications_sent ON sync_notifications(sent_at) WHERE sent_at IS NULL;

-- Function to update sync job progress
CREATE OR REPLACE FUNCTION update_sync_job_progress(
  p_job_id UUID,
  p_progress JSONB
) RETURNS void AS $$
BEGIN
  UPDATE sync_jobs
  SET 
    progress = p_progress,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a sync job
CREATE OR REPLACE FUNCTION complete_sync_job(
  p_job_id UUID,
  p_result JSONB,
  p_error JSONB DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_duration_ms INTEGER;
BEGIN
  -- Get start time
  SELECT started_at INTO v_started_at
  FROM sync_jobs
  WHERE id = p_job_id;
  
  -- Calculate duration
  IF v_started_at IS NOT NULL THEN
    v_duration_ms := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;
  END IF;
  
  -- Update job
  UPDATE sync_jobs
  SET 
    status = CASE WHEN p_error IS NULL THEN 'completed' ELSE 'failed' END,
    completed_at = NOW(),
    duration_ms = v_duration_ms,
    result = p_result,
    error = p_error,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Remove from queue
  DELETE FROM sync_queue WHERE job_id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get next job from queue
CREATE OR REPLACE FUNCTION claim_next_sync_job(
  p_worker_id TEXT,
  p_lock_duration_seconds INTEGER DEFAULT 300
) RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Find and lock the next available job
  UPDATE sync_queue
  SET 
    locked_by = p_worker_id,
    locked_at = NOW(),
    attempts = attempts + 1
  WHERE id = (
    SELECT id
    FROM sync_queue
    WHERE 
      locked_by IS NULL
      AND next_attempt_at <= NOW()
      AND attempts < max_attempts
    ORDER BY priority DESC, next_attempt_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING job_id INTO v_job_id;
  
  -- Update job status to running
  IF v_job_id IS NOT NULL THEN
    UPDATE sync_jobs
    SET 
      status = 'running',
      started_at = COALESCE(started_at, NOW()),
      updated_at = NOW()
    WHERE id = v_job_id;
  END IF;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to release a locked job (for retry)
CREATE OR REPLACE FUNCTION release_sync_job(
  p_job_id UUID,
  p_retry_delay_seconds INTEGER DEFAULT 60
) RETURNS void AS $$
BEGIN
  UPDATE sync_queue
  SET 
    locked_by = NULL,
    locked_at = NULL,
    next_attempt_at = NOW() + (p_retry_delay_seconds || ' seconds')::INTERVAL
  WHERE job_id = p_job_id;
  
  UPDATE sync_jobs
  SET 
    status = 'pending',
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate sync statistics
CREATE OR REPLACE FUNCTION get_sync_statistics(
  p_integration_id UUID,
  p_period TEXT DEFAULT 'day'
) RETURNS TABLE (
  total_syncs INTEGER,
  successful_syncs INTEGER,
  failed_syncs INTEGER,
  average_duration_ms INTEGER,
  total_records_synced BIGINT,
  total_conflicts INTEGER,
  total_errors INTEGER
) AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  -- Determine interval based on period
  v_interval := CASE p_period
    WHEN 'hour' THEN INTERVAL '1 hour'
    WHEN 'day' THEN INTERVAL '1 day'
    WHEN 'week' THEN INTERVAL '1 week'
    WHEN 'month' THEN INTERVAL '1 month'
    ELSE INTERVAL '1 day'
  END;
  
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_syncs,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as successful_syncs,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_syncs,
    AVG(duration_ms)::INTEGER as average_duration_ms,
    COALESCE(SUM((result->>'summary'->>'total_processed')::BIGINT), 0) as total_records_synced,
    (SELECT COUNT(*)::INTEGER FROM sync_conflicts WHERE sync_job_id IN (
      SELECT id FROM sync_jobs 
      WHERE integration_id = p_integration_id 
      AND created_at >= NOW() - v_interval
    )) as total_conflicts,
    COALESCE(SUM(JSONB_ARRAY_LENGTH(result->'errors')), 0)::INTEGER as total_errors
  FROM sync_jobs
  WHERE 
    integration_id = p_integration_id
    AND created_at >= NOW() - v_interval;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
-- fix-58: Enable RLS on sync_queue but no policies needed
-- The sync_queue table is only accessed by service role (background workers)
-- No user-level access is required, so no RLS policies are defined
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_notifications ENABLE ROW LEVEL SECURITY;

-- Sync jobs policies
CREATE POLICY "Users can view their organization's sync jobs" ON sync_jobs
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sync jobs for their organization" ON sync_jobs
  FOR INSERT WITH CHECK (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's sync jobs" ON sync_jobs
  FOR UPDATE USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Sync state policies
CREATE POLICY "Users can view sync state for their integrations" ON sync_state
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage sync state for their integrations" ON sync_state
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Sync schedules policies
CREATE POLICY "Users can view sync schedules for their integrations" ON sync_schedules
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage sync schedules for their integrations" ON sync_schedules
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Sync conflicts policies
CREATE POLICY "Users can view conflicts for their sync jobs" ON sync_conflicts
  FOR SELECT USING (
    sync_job_id IN (
      SELECT id FROM sync_jobs
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can resolve conflicts for their sync jobs" ON sync_conflicts
  FOR UPDATE USING (
    sync_job_id IN (
      SELECT id FROM sync_jobs
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Sync metrics policies
CREATE POLICY "Users can view metrics for their sync jobs" ON sync_metrics
  FOR SELECT USING (
    sync_job_id IN (
      SELECT id FROM sync_jobs
      WHERE organization_id = (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Sync notifications policies
CREATE POLICY "Users can view their organization's notifications" ON sync_notifications
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Note: sync_queue table doesn't need RLS as it's only accessed by the system

-- Triggers for updated_at
CREATE TRIGGER update_sync_jobs_updated_at
  BEFORE UPDATE ON sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sync_state_updated_at
  BEFORE UPDATE ON sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sync_schedules_updated_at
  BEFORE UPDATE ON sync_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();