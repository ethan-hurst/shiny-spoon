-- Create orders table for managing customer orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  order_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  
  -- Order totals
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Addresses
  billing_address JSONB,
  shipping_address JSONB,
  
  -- Dates
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Integration info
  external_order_id TEXT,
  source_platform TEXT,
  sync_status TEXT DEFAULT 'pending',
  last_sync_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Ensure unique order numbers per organization
  CONSTRAINT unique_order_number_per_org UNIQUE (organization_id, order_number)
);

-- Create order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Item details (denormalized for historical accuracy)
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Quantities
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  shipped_quantity INTEGER DEFAULT 0,
  
  -- Pricing
  unit_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_price DECIMAL(10, 2) NOT NULL,
  
  -- Warehouse info
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create order status history table
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  previous_status TEXT,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_orders_organization_id ON orders(organization_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_external_order_id ON orders(external_order_id) WHERE external_order_id IS NOT NULL;
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
CREATE POLICY "Users can view their organization's orders" ON orders
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create orders for their organization" ON orders
  FOR INSERT WITH CHECK (
    organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's orders" ON orders
  FOR UPDATE USING (
    organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for order_items
CREATE POLICY "Users can view order items for their organization's orders" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage order items for their organization's orders" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for order_status_history
CREATE POLICY "Users can view status history for their organization's orders" ON order_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_status_history.order_id 
      AND orders.organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can add status history for their organization's orders" ON order_status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_status_history.order_id 
      AND orders.organization_id = (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to log status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (
      order_id,
      status,
      previous_status,
      changed_by,
      metadata
    ) VALUES (
      NEW.id,
      NEW.status,
      OLD.status,
      NEW.updated_by,
      jsonb_build_object(
        'changed_at', NOW(),
        'trigger', 'status_update'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_status_change_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- Create view for order summary with items
CREATE OR REPLACE VIEW order_summary AS
SELECT 
  o.*,
  c.name as customer_name,
  c.email as customer_email,
  c.tier as customer_tier,
  COUNT(oi.id) as item_count,
  SUM(oi.quantity) as total_quantity,
  array_agg(
    jsonb_build_object(
      'id', oi.id,
      'sku', oi.sku,
      'name', oi.name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'total_price', oi.total_price
    ) ORDER BY oi.created_at
  ) as items
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, c.id;

-- Update the customer order summary function
CREATE OR REPLACE FUNCTION get_customer_order_summary(p_customer_id UUID)
RETURNS TABLE (
  total_orders BIGINT,
  total_amount DECIMAL,
  average_order_value DECIMAL,
  last_order_date TIMESTAMPTZ,
  status_counts JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_orders,
    COALESCE(SUM(total_amount), 0)::DECIMAL as total_amount,
    COALESCE(AVG(total_amount), 0)::DECIMAL as average_order_value,
    MAX(order_date) as last_order_date,
    jsonb_object_agg(
      status, 
      count
    ) FILTER (WHERE status IS NOT NULL) as status_counts
  FROM orders
  LEFT JOIN LATERAL (
    SELECT status, COUNT(*) as count
    FROM orders
    WHERE customer_id = p_customer_id
    GROUP BY status
  ) status_summary ON true
  WHERE customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON orders TO authenticated;
GRANT ALL ON order_items TO authenticated;
GRANT ALL ON order_status_history TO authenticated;
GRANT SELECT ON order_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_order_summary TO authenticated;