-- Create order tracking table for tracking order status changes
CREATE TABLE order_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Tracking details
  status TEXT NOT NULL,
  location TEXT,
  description TEXT NOT NULL,
  tracking_number TEXT,
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Create shipping integrations table
CREATE TABLE shipping_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Integration details
  provider TEXT NOT NULL, -- 'fedex', 'ups', 'usps', 'dhl', etc.
  tracking_number TEXT,
  label_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'shipped', 'delivered', 'failed')),
  
  -- Shipping details
  service_level TEXT, -- 'ground', 'express', 'overnight', etc.
  weight DECIMAL(10, 2),
  dimensions JSONB, -- {length, width, height}
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX idx_order_tracking_order_id ON order_tracking(order_id);
CREATE INDEX idx_order_tracking_status ON order_tracking(status);
CREATE INDEX idx_order_tracking_timestamp ON order_tracking(timestamp);
CREATE INDEX idx_shipping_integrations_organization_id ON shipping_integrations(organization_id);
CREATE INDEX idx_shipping_integrations_order_id ON shipping_integrations(order_id);
CREATE INDEX idx_shipping_integrations_provider ON shipping_integrations(provider);
CREATE INDEX idx_shipping_integrations_status ON shipping_integrations(status);

-- Enable RLS
ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_tracking
CREATE POLICY "Users can view order tracking from their organization" ON order_tracking
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE organization_id IN (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert order tracking for their organization" ON order_tracking
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE organization_id IN (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update order tracking from their organization" ON order_tracking
  FOR UPDATE USING (
    order_id IN (
      SELECT id FROM orders WHERE organization_id IN (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete order tracking from their organization" ON order_tracking
  FOR DELETE USING (
    order_id IN (
      SELECT id FROM orders WHERE organization_id IN (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for shipping_integrations
CREATE POLICY "Users can view shipping integrations from their organization" ON shipping_integrations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert shipping integrations for their organization" ON shipping_integrations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update shipping integrations from their organization" ON shipping_integrations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete shipping integrations from their organization" ON shipping_integrations
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Create updated_at trigger for shipping_integrations
CREATE OR REPLACE FUNCTION update_shipping_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shipping_integrations_updated_at
  BEFORE UPDATE ON shipping_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_integrations_updated_at(); 