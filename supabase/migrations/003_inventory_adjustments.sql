-- Create inventory_adjustments table for audit trail
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  adjustment INTEGER NOT NULL, -- Can be positive or negative
  reason TEXT NOT NULL CHECK (reason IN (
    'sale', 'return', 'damage', 'theft', 'found', 
    'transfer_in', 'transfer_out', 'cycle_count', 'other'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_inventory_adjustments_inventory_id ON inventory_adjustments(inventory_id);
CREATE INDEX idx_inventory_adjustments_created_at ON inventory_adjustments(created_at);
CREATE INDEX idx_inventory_adjustments_organization_id ON inventory_adjustments(organization_id);

-- Enable RLS
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_adjustments
CREATE POLICY "Users can view their organization's adjustments" ON inventory_adjustments
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create adjustments for their organization" ON inventory_adjustments
  FOR INSERT WITH CHECK (
    organization_id = (
      SELECT organization_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Update function to update inventory updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory 
  SET updated_at = NOW() 
  WHERE id = NEW.inventory_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update inventory timestamp on adjustment
CREATE TRIGGER update_inventory_on_adjustment
  AFTER INSERT ON inventory_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

-- Add updated_by column to inventory if not exists
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add reorder_point and reorder_quantity to inventory if not exists
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_quantity INTEGER DEFAULT 0;

-- Create a view for inventory with user details
CREATE OR REPLACE VIEW inventory_adjustments_with_user AS
SELECT 
  ia.*,
  up.full_name as user_full_name,
  au.email as user_email
FROM inventory_adjustments ia
JOIN user_profiles up ON ia.created_by = up.user_id
JOIN auth.users au ON ia.created_by = au.id;

-- Grant access to the view
GRANT SELECT ON inventory_adjustments_with_user TO authenticated;

-- Function to calculate available inventory (on_hand - reserved)
CREATE OR REPLACE FUNCTION calculate_available_inventory(inventory_row inventory)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(inventory_row.quantity, 0) - COALESCE(inventory_row.reserved_quantity, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment for documentation
COMMENT ON TABLE inventory_adjustments IS 'Audit trail for all inventory quantity changes';
COMMENT ON COLUMN inventory_adjustments.adjustment IS 'The change amount (positive for increases, negative for decreases)';
COMMENT ON COLUMN inventory_adjustments.reason IS 'Standardized reason for the adjustment';