-- RPC function to update reserved inventory
CREATE OR REPLACE FUNCTION update_inventory_reserved(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_quantity INTEGER,
  p_operation TEXT -- 'reserve' or 'release'
)
RETURNS VOID AS $$
DECLARE
  v_current_reserved INTEGER;
  v_current_quantity INTEGER;
BEGIN
  -- Get current inventory levels
  SELECT quantity, reserved_quantity
  INTO v_current_quantity, v_current_reserved
  FROM inventory
  WHERE product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory record not found';
  END IF;

  -- Update based on operation
  IF p_operation = 'reserve' THEN
    -- Check if we have enough available inventory
    IF (v_current_quantity - v_current_reserved) < p_quantity THEN
      RAISE EXCEPTION 'Insufficient available inventory';
    END IF;
    
    UPDATE inventory
    SET reserved_quantity = reserved_quantity + p_quantity,
        updated_at = NOW(),
        updated_by = auth.uid()
    WHERE product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      );
      
  ELSIF p_operation = 'release' THEN
    -- Ensure we don't go negative
    IF v_current_reserved < ABS(p_quantity) THEN
      RAISE EXCEPTION 'Cannot release more than reserved quantity';
    END IF;
    
    UPDATE inventory
    SET reserved_quantity = reserved_quantity + p_quantity, -- p_quantity should be negative for release
        updated_at = NOW(),
        updated_by = auth.uid()
    WHERE product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      );
  ELSE
    RAISE EXCEPTION 'Invalid operation. Use "reserve" or "release"';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to ship inventory (convert reserved to shipped)
CREATE OR REPLACE FUNCTION ship_inventory(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_quantity INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_current_quantity INTEGER;
  v_current_reserved INTEGER;
BEGIN
  -- Get current inventory levels
  SELECT quantity, reserved_quantity
  INTO v_current_quantity, v_current_reserved
  FROM inventory
  WHERE product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory record not found';
  END IF;

  -- Check if we have enough reserved inventory
  IF v_current_reserved < p_quantity THEN
    RAISE EXCEPTION 'Insufficient reserved inventory to ship';
  END IF;

  -- Check if we have enough total inventory
  IF v_current_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory to ship';
  END IF;

  -- Update inventory: reduce both quantity and reserved quantity
  UPDATE inventory
  SET quantity = quantity - p_quantity,
      reserved_quantity = reserved_quantity - p_quantity,
      updated_at = NOW(),
      updated_by = auth.uid()
  WHERE product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    );

  -- Log the shipment in inventory history
  INSERT INTO inventory_adjustments (
    inventory_id,
    adjustment_type,
    quantity_change,
    reason,
    reference_type,
    reference_id,
    user_id
  )
  SELECT 
    id,
    'shipment',
    -p_quantity,
    'Order shipment',
    'order',
    NULL, -- Should be passed as parameter in real implementation
    auth.uid()
  FROM inventory
  WHERE product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_inventory_reserved TO authenticated;
GRANT EXECUTE ON FUNCTION ship_inventory TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_reserved ON inventory(organization_id, product_id, warehouse_id, reserved_quantity);

-- Add comments for documentation
COMMENT ON FUNCTION update_inventory_reserved IS 'Updates reserved inventory quantity for orders. Use positive quantity to reserve, negative to release.';
COMMENT ON FUNCTION ship_inventory IS 'Converts reserved inventory to shipped by reducing both quantity and reserved_quantity.';