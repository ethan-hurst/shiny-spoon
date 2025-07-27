-- Bulk Operations System Schema
-- Enables high-performance bulk operations with tracking, progress monitoring, and rollback capabilities

-- Bulk operations tracking table
CREATE TABLE IF NOT EXISTS bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('import', 'export', 'update', 'delete')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('products', 'inventory', 'pricing', 'customers')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'rolled_back')),

  -- File information
  file_name TEXT,
  file_size_bytes BIGINT,
  file_url TEXT,

  -- Progress tracking
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion TIMESTAMPTZ,

  -- Configuration and results (stored as JSONB for flexibility)
  config JSONB DEFAULT '{}',
  results JSONB DEFAULT '{}',
  error_log JSONB DEFAULT '[]',

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),

  -- Add updated_at for change tracking
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Operation records for detailed tracking and rollback capability
CREATE TABLE IF NOT EXISTS bulk_operation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES bulk_operations(id) ON DELETE CASCADE NOT NULL,
  record_index INTEGER NOT NULL,
  entity_id UUID, -- ID of the affected entity (product, customer, etc.)

  -- Change tracking for rollback
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  before_data JSONB, -- State before the operation
  after_data JSONB,  -- State after the operation

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rolled_back')),
  error TEXT,

  processed_at TIMESTAMPTZ,

  -- Ensure unique record index per operation
  UNIQUE(operation_id, record_index)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_bulk_operations_org_status 
  ON bulk_operations(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_created 
  ON bulk_operations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_type 
  ON bulk_operations(operation_type, entity_type);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_status_updated 
  ON bulk_operations(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_operation_records_operation 
  ON bulk_operation_records(operation_id, status);

CREATE INDEX IF NOT EXISTS idx_bulk_operation_records_processed 
  ON bulk_operation_records(processed_at DESC) WHERE processed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bulk_operation_records_entity 
  ON bulk_operation_records(entity_id) WHERE entity_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_operation_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bulk_operations
CREATE POLICY "Users can view own organization bulk operations" 
  ON bulk_operations FOR SELECT 
  USING (
    organization_id = (
      SELECT organization_id 
      FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create bulk operations for own organization" 
  ON bulk_operations FOR INSERT 
  WITH CHECK (
    organization_id = (
      SELECT organization_id 
      FROM user_profiles 
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update own organization bulk operations" 
  ON bulk_operations FOR UPDATE 
  USING (
    organization_id = (
      SELECT organization_id 
      FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for bulk_operation_records  
CREATE POLICY "Users can view own organization bulk operation records" 
  ON bulk_operation_records FOR SELECT 
  USING (
    operation_id IN (
      SELECT id 
      FROM bulk_operations 
      WHERE organization_id = (
        SELECT organization_id 
        FROM user_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create bulk operation records for own organization" 
  ON bulk_operation_records FOR INSERT 
  WITH CHECK (
    operation_id IN (
      SELECT id 
      FROM bulk_operations 
      WHERE organization_id = (
        SELECT organization_id 
        FROM user_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update bulk operation records for own organization" 
  ON bulk_operation_records FOR UPDATE 
  USING (
    operation_id IN (
      SELECT id 
      FROM bulk_operations 
      WHERE organization_id = (
        SELECT organization_id 
        FROM user_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_bulk_operations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating updated_at on bulk_operations
CREATE TRIGGER trigger_bulk_operations_updated_at
  BEFORE UPDATE ON bulk_operations
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_operations_updated_at();

-- View for operation summary with statistics
CREATE OR REPLACE VIEW bulk_operations_summary AS
SELECT 
  bo.id,
  bo.organization_id,
  bo.operation_type,
  bo.entity_type,
  bo.status,
  bo.file_name,
  bo.file_size_bytes,
  bo.total_records,
  bo.processed_records,
  bo.successful_records,
  bo.failed_records,
  bo.created_at,
  bo.started_at,
  bo.completed_at,
  bo.estimated_completion,
  CASE 
    WHEN bo.total_records > 0 
    THEN ROUND((bo.processed_records::DECIMAL / bo.total_records::DECIMAL) * 100, 2)
    ELSE 0 
  END AS progress_percentage,
  CASE 
    WHEN bo.started_at IS NOT NULL AND bo.status = 'processing'
    THEN EXTRACT(EPOCH FROM (NOW() - bo.started_at))
    WHEN bo.started_at IS NOT NULL AND bo.completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (bo.completed_at - bo.started_at))
    ELSE NULL
  END AS duration_seconds,
  users.email as created_by_email
FROM bulk_operations bo
LEFT JOIN auth.users users ON bo.created_by = users.id;

-- Grant access to the view
GRANT SELECT ON bulk_operations_summary TO authenticated;

-- Function to get operation progress
CREATE OR REPLACE FUNCTION get_bulk_operation_progress(operation_uuid UUID)
RETURNS JSON AS $$
DECLARE
  operation_data RECORD;
  progress_data JSON;
BEGIN
  -- Get operation details
  SELECT 
    id,
    status,
    total_records,
    processed_records,
    successful_records,
    failed_records,
    started_at,
    estimated_completion,
    results
  INTO operation_data
  FROM bulk_operations
  WHERE id = operation_uuid;

  -- Return null if operation not found
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Build progress JSON
  progress_data := json_build_object(
    'operationId', operation_data.id,
    'status', operation_data.status,
    'totalRecords', COALESCE(operation_data.total_records, 0),
    'processedRecords', COALESCE(operation_data.processed_records, 0),
    'successfulRecords', COALESCE(operation_data.successful_records, 0),
    'failedRecords', COALESCE(operation_data.failed_records, 0),
    'progressPercentage', 
      CASE 
        WHEN COALESCE(operation_data.total_records, 0) > 0 
        THEN ROUND((COALESCE(operation_data.processed_records, 0)::DECIMAL / operation_data.total_records::DECIMAL) * 100, 2)
        ELSE 0 
      END,
    'estimatedCompletion', operation_data.estimated_completion,
    'results', COALESCE(operation_data.results, '{}'::jsonb)
  );

  RETURN progress_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_bulk_operation_progress(UUID) TO authenticated;

-- Function to cancel a bulk operation
CREATE OR REPLACE FUNCTION cancel_bulk_operation(operation_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  operation_exists BOOLEAN;
  user_org_id UUID;
  operation_org_id UUID;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO user_org_id
  FROM user_profiles
  WHERE user_id = user_uuid;

  -- Get operation's organization and check if it exists
  SELECT organization_id INTO operation_org_id
  FROM bulk_operations
  WHERE id = operation_uuid;

  -- Check if operation exists and user has access
  IF operation_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF user_org_id != operation_org_id THEN
    RETURN FALSE;
  END IF;

  -- Update operation status
  UPDATE bulk_operations
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = user_uuid,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = operation_uuid
    AND status IN ('pending', 'processing');

  -- Return true if update was successful
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cancel_bulk_operation(UUID, UUID) TO authenticated;

COMMENT ON TABLE bulk_operations IS 'Tracks bulk operations for import, export, update, and delete operations across different entity types';
COMMENT ON TABLE bulk_operation_records IS 'Detailed records for each item processed in a bulk operation, enabling rollback functionality';
COMMENT ON VIEW bulk_operations_summary IS 'Summary view of bulk operations with calculated progress and duration metrics';
COMMENT ON FUNCTION get_bulk_operation_progress(UUID) IS 'Returns real-time progress data for a bulk operation';
COMMENT ON FUNCTION cancel_bulk_operation(UUID, UUID) IS 'Cancels a bulk operation if user has permission';