-- Create function to calculate available inventory
CREATE OR REPLACE FUNCTION calculate_available_inventory(inventory_row inventory)
RETURNS INTEGER AS $$
BEGIN
  RETURN inventory_row.quantity - COALESCE(inventory_row.reserved_quantity, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view that includes available inventory
CREATE OR REPLACE VIEW inventory_with_available AS
SELECT 
  i.*,
  calculate_available_inventory(i) as available_quantity,
  CASE 
    WHEN calculate_available_inventory(i) <= COALESCE(i.reorder_point, 0) THEN true
    ELSE false
  END as is_low_stock
FROM inventory i;

-- Grant permissions
GRANT SELECT ON inventory_with_available TO authenticated;
