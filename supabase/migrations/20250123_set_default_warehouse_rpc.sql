-- Create RPC function for atomically setting default warehouse
CREATE OR REPLACE FUNCTION set_default_warehouse(warehouse_id UUID, org_id UUID)
RETURNS void AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  -- Verify the warehouse exists and belongs to the organization
  IF NOT EXISTS (
    SELECT 1 FROM warehouses 
    WHERE id = warehouse_id 
    AND organization_id = org_id 
    AND active = true
  ) THEN
    RAISE EXCEPTION 'Warehouse not found or inactive';
  END IF;

  -- Unset current default warehouse for the organization
  UPDATE warehouses
  SET is_default = false
  WHERE organization_id = org_id
  AND is_default = true
  AND id != warehouse_id;

  -- Set the new default warehouse
  UPDATE warehouses
  SET is_default = true
  WHERE id = warehouse_id
  AND organization_id = org_id;

  -- Check if the update actually affected any rows
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Failed to set default warehouse';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_default_warehouse(UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION set_default_warehouse(UUID, UUID) IS 'Atomically sets a warehouse as the default for an organization';