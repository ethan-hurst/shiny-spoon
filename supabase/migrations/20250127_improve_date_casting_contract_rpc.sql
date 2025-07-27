-- PRP-017A: Improve date casting and error handling in contract update RPC

-- Drop the existing function first
DROP FUNCTION IF EXISTS update_contract_with_items(UUID, JSONB, JSONB, UUID);

-- Function to atomically update contract and its items with improved date handling
CREATE OR REPLACE FUNCTION update_contract_with_items(
  p_contract_id UUID,
  p_contract_data JSONB,
  p_contract_items JSONB,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_signed_date DATE;
BEGIN
  -- Validate required parameters
  IF p_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract ID cannot be null';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  -- Validate and cast dates with proper error handling
  BEGIN
    -- Start date validation
    IF p_contract_data->>'start_date' IS NOT NULL AND p_contract_data->>'start_date' != '' THEN
      v_start_date := (p_contract_data->>'start_date')::DATE;
    ELSE
      RAISE EXCEPTION 'Start date is required';
    END IF;
    
    -- End date validation
    IF p_contract_data->>'end_date' IS NOT NULL AND p_contract_data->>'end_date' != '' THEN
      v_end_date := (p_contract_data->>'end_date')::DATE;
    ELSE
      RAISE EXCEPTION 'End date is required';
    END IF;
    
    -- Validate date range
    IF v_end_date <= v_start_date THEN
      RAISE EXCEPTION 'End date must be after start date';
    END IF;
    
    -- Signed date validation (optional)
    IF p_contract_data->>'signed_date' IS NOT NULL AND p_contract_data->>'signed_date' != '' THEN
      v_signed_date := (p_contract_data->>'signed_date')::DATE;
      
      -- Signed date cannot be in the future
      IF v_signed_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Signed date cannot be in the future';
      END IF;
    END IF;
    
  EXCEPTION
    WHEN invalid_datetime_format THEN
      RAISE EXCEPTION 'Invalid date format. Please use YYYY-MM-DD format';
    WHEN datetime_field_overflow THEN
      RAISE EXCEPTION 'Date value out of range';
  END;
  
  -- Update the contract
  UPDATE customer_contracts
  SET
    contract_number = p_contract_data->>'contract_number',
    contract_name = p_contract_data->>'contract_name',
    description = p_contract_data->>'description',
    start_date = v_start_date,
    end_date = v_end_date,
    signed_date = v_signed_date,
    status = p_contract_data->>'status',
    auto_renew = COALESCE((p_contract_data->>'auto_renew')::BOOLEAN, FALSE),
    renewal_period_months = NULLIF(p_contract_data->>'renewal_period_months', '')::INTEGER,
    expiry_notification_days = COALESCE(NULLIF(p_contract_data->>'expiry_notification_days', '')::INTEGER, 30),
    document_url = p_contract_data->>'document_url',
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE id = p_contract_id
    AND customer_id = (p_contract_data->>'customer_id')::UUID;
  
  -- Check if the update affected any rows
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found or access denied';
  END IF;
  
  -- Delete existing items
  DELETE FROM contract_items
  WHERE contract_id = p_contract_id;
  
  -- Insert new items if provided
  IF p_contract_items IS NOT NULL AND jsonb_array_length(p_contract_items) > 0 THEN
    -- Validate items structure
    IF jsonb_typeof(p_contract_items) != 'array' THEN
      RAISE EXCEPTION 'Contract items must be a JSON array';
    END IF;
    
    INSERT INTO contract_items (
      contract_id,
      product_id,
      price,
      min_quantity,
      max_quantity
    )
    SELECT 
      p_contract_id,
      (item->>'product_id')::UUID,
      (item->>'price')::DECIMAL(10,2),
      (item->>'min_quantity')::INTEGER,
      NULLIF(item->>'max_quantity', '')::INTEGER
    FROM jsonb_array_elements(p_contract_items) AS item;
  END IF;
EXCEPTION
  WHEN check_violation THEN
    RAISE;
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Invalid reference: %', SQLERRM;
  WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Numeric value out of range: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_contract_with_items TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION update_contract_with_items(UUID, JSONB, JSONB, UUID) IS 
'Atomically updates a customer contract and its items with comprehensive date validation and error handling.';