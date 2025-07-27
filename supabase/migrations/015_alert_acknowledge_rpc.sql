-- PRP-016: RPC function for atomic alert acknowledgment
-- This function ensures alert status update and audit log insert happen in a single transaction

CREATE OR REPLACE FUNCTION acknowledge_alert(
  p_alert_id UUID,
  p_organization_id UUID,
  p_user_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alert RECORD;
  v_result JSONB;
BEGIN
  -- Verify alert exists and belongs to organization
  SELECT * INTO v_alert
  FROM alerts
  WHERE id = p_alert_id
    AND organization_id = p_organization_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alert not found or not active';
  END IF;

  -- Update alert status
  UPDATE alerts
  SET 
    status = 'acknowledged',
    acknowledged_at = NOW(),
    acknowledged_by = p_user_id,
    acknowledgment_note = p_note
  WHERE id = p_alert_id;

  -- Insert audit log
  INSERT INTO audit_logs (
    organization_id,
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    p_organization_id,
    p_user_id,
    'alert.acknowledged',
    'alert',
    p_alert_id,
    jsonb_build_object(
      'alert_type', v_alert.alert_type,
      'severity', v_alert.severity,
      'note', p_note
    )
  );

  -- Return result
  v_result := jsonb_build_object(
    'alertId', p_alert_id,
    'acknowledgedAt', NOW(),
    'acknowledgedBy', p_user_id
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION acknowledge_alert TO authenticated;