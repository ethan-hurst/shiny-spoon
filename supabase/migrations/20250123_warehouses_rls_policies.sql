-- Enable RLS on warehouses table if not already enabled
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view warehouses in their organization" ON warehouses;
DROP POLICY IF EXISTS "Users can insert warehouses in their organization" ON warehouses;
DROP POLICY IF EXISTS "Users can update warehouses in their organization" ON warehouses;
DROP POLICY IF EXISTS "Users can delete warehouses in their organization" ON warehouses;

-- Policy for SELECT: Users can only view warehouses in their organization
CREATE POLICY "Users can view warehouses in their organization" ON warehouses
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM user_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Policy for INSERT: Users can only create warehouses in their organization
CREATE POLICY "Users can insert warehouses in their organization" ON warehouses
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM user_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Policy for UPDATE: Users can only update warehouses in their organization
CREATE POLICY "Users can update warehouses in their organization" ON warehouses
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM user_profiles 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM user_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Policy for DELETE: Users can only delete warehouses in their organization
CREATE POLICY "Users can delete warehouses in their organization" ON warehouses
FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM user_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Add comment explaining the security model
COMMENT ON TABLE warehouses IS 'Warehouse locations for inventory management. Protected by RLS policies that restrict access to organization members only.';