-- Add computed column for low stock detection to inventory table
ALTER TABLE inventory 
ADD COLUMN is_low_stock BOOLEAN GENERATED ALWAYS AS (
  CASE 
    WHEN reorder_point IS NOT NULL THEN (quantity - reserved_quantity) < reorder_point
    ELSE (quantity - reserved_quantity) < 10
  END
) STORED;

-- Create index for performance on low stock queries
CREATE INDEX idx_inventory_low_stock ON inventory(organization_id, is_low_stock) 
WHERE is_low_stock = true;

-- Update the inventory_with_details view to include low stock flag
CREATE OR REPLACE VIEW inventory_with_details AS
SELECT 
  i.id,
  i.organization_id,
  i.product_id,
  i.warehouse_id,
  i.quantity,
  i.reserved_quantity,
  i.reorder_point,
  i.reorder_quantity,
  i.last_sync,
  i.sync_status,
  i.created_at,
  i.updated_at,
  i.updated_by,
  i.is_low_stock,
  p.sku as product_sku,
  p.name as product_name,
  p.category as product_category,
  p.base_price as product_price,
  p.image_url as product_image,
  w.name as warehouse_name,
  w.is_default as warehouse_is_default,
  (i.quantity - i.reserved_quantity) as available_quantity
FROM inventory i
INNER JOIN products p ON i.product_id = p.id
INNER JOIN warehouses w ON i.warehouse_id = w.id;

-- Grant permissions on the view
GRANT SELECT ON inventory_with_details TO authenticated;

-- Create function to get low stock summary
CREATE OR REPLACE FUNCTION get_low_stock_summary(p_organization_id UUID)
RETURNS TABLE (
  total_low_stock_items BIGINT,
  total_out_of_stock BIGINT,
  low_stock_value DECIMAL,
  critical_items JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH low_stock_data AS (
    SELECT 
      i.id,
      i.product_id,
      i.quantity,
      i.reserved_quantity,
      i.reorder_point,
      p.name as product_name,
      p.sku,
      p.base_price,
      (i.quantity - i.reserved_quantity) as available_quantity,
      CASE 
        WHEN (i.quantity - i.reserved_quantity) <= 0 THEN 'out_of_stock'
        WHEN i.is_low_stock THEN 'low_stock'
        ELSE 'in_stock'
      END as stock_status
    FROM inventory i
    INNER JOIN products p ON i.product_id = p.id
    WHERE i.organization_id = p_organization_id
  )
  SELECT 
    COUNT(*) FILTER (WHERE stock_status = 'low_stock')::BIGINT as total_low_stock_items,
    COUNT(*) FILTER (WHERE stock_status = 'out_of_stock')::BIGINT as total_out_of_stock,
    COALESCE(SUM(base_price * available_quantity) FILTER (WHERE stock_status IN ('low_stock', 'out_of_stock')), 0)::DECIMAL as low_stock_value,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_id', product_id,
          'product_name', product_name,
          'sku', sku,
          'available_quantity', available_quantity,
          'reorder_point', reorder_point
        ) ORDER BY available_quantity ASC
      ) FILTER (WHERE stock_status IN ('low_stock', 'out_of_stock')),
      '[]'::jsonb
    ) as critical_items
  FROM low_stock_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_low_stock_summary TO authenticated;

-- Create alert trigger for low stock items
CREATE OR REPLACE FUNCTION check_low_stock_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_alert_exists BOOLEAN;
BEGIN
  -- Only check if quantity changed and item is now low stock
  IF NEW.is_low_stock AND (OLD.is_low_stock IS DISTINCT FROM NEW.is_low_stock) THEN
    -- Check if alert already exists for this product/warehouse
    SELECT EXISTS(
      SELECT 1 FROM alerts
      WHERE organization_id = NEW.organization_id
        AND entity_type = 'inventory'
        AND entity_id = NEW.id
        AND type = 'low_stock'
        AND status = 'active'
    ) INTO v_alert_exists;

    -- Create alert if it doesn't exist
    IF NOT v_alert_exists THEN
      INSERT INTO alerts (
        organization_id,
        title,
        message,
        type,
        severity,
        entity_type,
        entity_id,
        metadata
      ) VALUES (
        NEW.organization_id,
        'Low Stock Alert',
        format('Product is running low on stock. Available quantity: %s', NEW.quantity - NEW.reserved_quantity),
        'low_stock',
        'medium',
        'inventory',
        NEW.id,
        jsonb_build_object(
          'product_id', NEW.product_id,
          'warehouse_id', NEW.warehouse_id,
          'quantity', NEW.quantity,
          'reserved_quantity', NEW.reserved_quantity,
          'reorder_point', NEW.reorder_point
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for low stock alerts
CREATE TRIGGER inventory_low_stock_alert
  AFTER INSERT OR UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION check_low_stock_alert();

-- Add comment for documentation
COMMENT ON COLUMN inventory.is_low_stock IS 'Computed column indicating if available inventory is below reorder point or default threshold';