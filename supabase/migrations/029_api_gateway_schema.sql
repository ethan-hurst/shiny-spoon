-- API Gateway Schema Migration

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro', 'enterprise')),
  rate_limit JSONB DEFAULT '{"requests": 100, "window": 3600}',
  ip_whitelist TEXT[] DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_rate_limit CHECK (
    rate_limit ? 'requests' AND 
    rate_limit ? 'window' AND
    (rate_limit->>'requests')::INT > 0 AND
    (rate_limit->>'window')::INT > 0
  )
);

-- Webhook Subscriptions table
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  description TEXT,
  headers JSONB DEFAULT '{}',
  retry_config JSONB DEFAULT '{"maxAttempts": 3, "backoffMultiplier": 2, "initialDelay": 60, "maxDelay": 3600}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_url CHECK (url ~ '^https?://'),
  CONSTRAINT valid_events CHECK (array_length(events, 1) > 0),
  CONSTRAINT valid_retry_config CHECK (
    retry_config ? 'maxAttempts' AND 
    retry_config ? 'backoffMultiplier' AND
    retry_config ? 'initialDelay' AND
    retry_config ? 'maxDelay' AND
    (retry_config->>'maxAttempts')::INT > 0 AND
    (retry_config->>'backoffMultiplier')::FLOAT > 1 AND
    (retry_config->>'initialDelay')::INT > 0 AND
    (retry_config->>'maxDelay')::INT > 0
  )
);

-- Webhook Events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  status_code INT,
  response TEXT,
  error TEXT,
  attempt_number INT NOT NULL DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- API Usage Stats table
CREATE TABLE IF NOT EXISTS api_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT NOT NULL,
  response_time INT NOT NULL, -- in milliseconds
  request_size INT,
  response_size INT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create partitions for API usage stats (monthly)
CREATE TABLE api_usage_stats_2024_01 PARTITION OF api_usage_stats
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE api_usage_stats_2024_02 PARTITION OF api_usage_stats
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Add more partitions as needed...

-- API Request Logs table (for debugging and audit)
CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  request_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  headers JSONB,
  query_params JSONB,
  body JSONB,
  ip_address INET,
  user_agent TEXT,
  status_code INT,
  response JSONB,
  error JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for request logs (daily)
CREATE TABLE api_request_logs_2024_01_01 PARTITION OF api_request_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-01-02');

-- Indexes
CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE active = TRUE;
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_webhook_subscriptions_tenant_id ON webhook_subscriptions(tenant_id);
CREATE INDEX idx_webhook_subscriptions_active ON webhook_subscriptions(active);
CREATE INDEX idx_webhook_subscriptions_events ON webhook_subscriptions USING GIN(events);

CREATE INDEX idx_webhook_events_tenant_id ON webhook_events(tenant_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(type);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry_at ON webhook_deliveries(next_retry_at) 
  WHERE status = 'retrying' AND next_retry_at IS NOT NULL;

CREATE INDEX idx_api_usage_stats_api_key_id ON api_usage_stats(api_key_id);
CREATE INDEX idx_api_usage_stats_endpoint ON api_usage_stats(endpoint);
CREATE INDEX idx_api_usage_stats_timestamp ON api_usage_stats(timestamp);

-- Functions

-- Generate API key
CREATE OR REPLACE FUNCTION generate_api_key(length INT DEFAULT 32)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN 'sk_' || result;
END;
$$ LANGUAGE plpgsql;

-- Calculate API usage statistics
CREATE OR REPLACE FUNCTION calculate_api_usage(
  p_api_key_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS TABLE (
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  avg_response_time FLOAT,
  total_bandwidth BIGINT,
  endpoints JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_requests,
    COUNT(*) FILTER (WHERE status_code < 400)::BIGINT AS successful_requests,
    COUNT(*) FILTER (WHERE status_code >= 400)::BIGINT AS failed_requests,
    AVG(response_time)::FLOAT AS avg_response_time,
    SUM(COALESCE(request_size, 0) + COALESCE(response_size, 0))::BIGINT AS total_bandwidth,
    jsonb_object_agg(
      endpoint || ':' || method,
      jsonb_build_object(
        'count', endpoint_count,
        'avg_response_time', avg_endpoint_time
      )
    ) AS endpoints
  FROM (
    SELECT 
      endpoint,
      method,
      COUNT(*) AS endpoint_count,
      AVG(response_time) AS avg_endpoint_time
    FROM api_usage_stats
    WHERE api_key_id = p_api_key_id
      AND timestamp >= p_start_date
      AND timestamp < p_end_date
    GROUP BY endpoint, method
  ) AS endpoint_stats
  CROSS JOIN LATERAL (
    SELECT *
    FROM api_usage_stats
    WHERE api_key_id = p_api_key_id
      AND timestamp >= p_start_date
      AND timestamp < p_end_date
  ) AS all_stats
  GROUP BY endpoint_stats.endpoint, endpoint_stats.method, endpoint_stats.endpoint_count, endpoint_stats.avg_endpoint_time;
END;
$$ LANGUAGE plpgsql;

-- Trigger webhook event
CREATE OR REPLACE FUNCTION trigger_webhook_event(
  p_tenant_id UUID,
  p_event_type TEXT,
  p_data JSONB
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_subscription RECORD;
BEGIN
  -- Create event
  INSERT INTO webhook_events (tenant_id, type, data)
  VALUES (p_tenant_id, p_event_type, p_data)
  RETURNING id INTO v_event_id;
  
  -- Create deliveries for active subscriptions
  FOR v_subscription IN
    SELECT id, url
    FROM webhook_subscriptions
    WHERE tenant_id = p_tenant_id
      AND active = TRUE
      AND p_event_type = ANY(events)
  LOOP
    INSERT INTO webhook_deliveries (webhook_id, event_id, url)
    VALUES (v_subscription.id, v_event_id, v_subscription.url);
  END LOOP;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Update webhook delivery status
CREATE OR REPLACE FUNCTION update_webhook_delivery(
  p_delivery_id UUID,
  p_status TEXT,
  p_status_code INT DEFAULT NULL,
  p_response TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_retry_config JSONB;
  v_attempt_number INT;
  v_next_retry_at TIMESTAMPTZ;
BEGIN
  -- Get current attempt number and retry config
  SELECT 
    d.attempt_number,
    s.retry_config
  INTO v_attempt_number, v_retry_config
  FROM webhook_deliveries d
  JOIN webhook_subscriptions s ON d.webhook_id = s.id
  WHERE d.id = p_delivery_id;
  
  -- Calculate next retry time if failed
  IF p_status = 'failed' AND v_attempt_number < (v_retry_config->>'maxAttempts')::INT THEN
    v_next_retry_at := NOW() + INTERVAL '1 second' * LEAST(
      (v_retry_config->>'initialDelay')::INT * POWER((v_retry_config->>'backoffMultiplier')::FLOAT, v_attempt_number - 1),
      (v_retry_config->>'maxDelay')::INT
    );
    p_status := 'retrying';
  END IF;
  
  -- Update delivery
  UPDATE webhook_deliveries
  SET 
    status = p_status,
    status_code = p_status_code,
    response = p_response,
    error = p_error,
    next_retry_at = v_next_retry_at,
    completed_at = CASE WHEN p_status IN ('success', 'failed') THEN NOW() ELSE NULL END
  WHERE id = p_delivery_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies

-- API Keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON api_keys
  FOR ALL USING (tenant_id = current_tenant_id());

-- Webhook Subscriptions
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON webhook_subscriptions
  FOR ALL USING (tenant_id = current_tenant_id());

-- Webhook Events
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON webhook_events
  FOR ALL USING (tenant_id = current_tenant_id());

-- API Usage Stats
ALTER TABLE api_usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON api_usage_stats
  FOR SELECT USING (
    api_key_id IN (
      SELECT id FROM api_keys WHERE tenant_id = current_tenant_id()
    )
  );

-- Triggers

-- Update updated_at timestamp
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_subscriptions_updated_at
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE api_keys IS 'Stores API keys for external access to the system';
COMMENT ON TABLE webhook_subscriptions IS 'Stores webhook subscription configurations';
COMMENT ON TABLE webhook_events IS 'Stores webhook events to be delivered';
COMMENT ON TABLE webhook_deliveries IS 'Tracks webhook delivery attempts and status';
COMMENT ON TABLE api_usage_stats IS 'Stores API usage statistics for analytics';
COMMENT ON TABLE api_request_logs IS 'Stores detailed API request logs for debugging';