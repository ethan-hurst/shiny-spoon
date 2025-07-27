-- PRP-016: Add JSONB validation to contract update RPC

-- Function to atomically update contract and its items with proper validation
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
BEGIN
  -- Validate contract data structure
  IF p_contract_data IS NULL THEN
    RAISE EXCEPTION 'Contract data cannot be null';
  END IF;
  
  -- Validate required fields in contract data
  IF NOT (p_contract_data ? 'contract_number' AND 
          p_contract_data ? 'contract_name' AND
          p_contract_data ? 'start_date' AND
          p_contract_data ? 'end_date' AND
          p_contract_data ? 'status' AND
          p_contract_data ? 'customer_id') THEN
    RAISE EXCEPTION 'Missing required contract fields';
  END IF;
  
  -- Validate data types
  BEGIN
    PERFORM (p_contract_data->>'customer_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid customer_id format';
  END;
  
  BEGIN
    PERFORM (p_contract_data->>'start_date')::DATE;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid start_date format';
  END;
  
  BEGIN
    PERFORM (p_contract_data->>'end_date')::DATE;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid end_date format';
  END;
  
  -- Validate dates logic
  IF (p_contract_data->>'start_date')::DATE > (p_contract_data->>'end_date')::DATE THEN
    RAISE EXCEPTION 'Start date must be before end date';
  END IF;
  
  -- Validate status value
  IF p_contract_data->>'status' NOT IN ('draft', 'active', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status value';
  END IF;
  
  -- Validate contract items if provided
  IF p_contract_items IS NOT NULL AND jsonb_array_length(p_contract_items) > 0 THEN
    -- Check if it's actually an array
    IF jsonb_typeof(p_contract_items) != 'array' THEN
      RAISE EXCEPTION 'Contract items must be an array';
    END IF;
    
    -- Validate each item
    FOR i IN 0..jsonb_array_length(p_contract_items) - 1 LOOP
      DECLARE
        item JSONB := p_contract_items->i;
      BEGIN
        -- Check required fields
        IF NOT (item ? 'product_id' AND item ? 'price') THEN
          RAISE EXCEPTION 'Missing required fields in contract item %', i;
        END IF;
        
        -- Validate product_id format
        BEGIN
          PERFORM (item->>'product_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid product_id format in item %', i;
        END;
        
        -- Validate price
        IF (item->>'price')::DECIMAL < 0 THEN
          RAISE EXCEPTION 'Price cannot be negative in item %', i;
        END IF;
        
        -- Validate quantities if provided
        IF item ? 'min_quantity' AND (item->>'min_quantity')::INTEGER < 0 THEN
          RAISE EXCEPTION 'Min quantity cannot be negative in item %', i;
        END IF;
        
        IF item ? 'max_quantity' AND item ? 'min_quantity' AND 
           (item->>'max_quantity')::INTEGER < (item->>'min_quantity')::INTEGER THEN
          RAISE EXCEPTION 'Max quantity must be greater than min quantity in item %', i;
        END IF;
      END;
    END LOOP;
  END IF;

  -- Update the contract
  UPDATE customer_contracts
  SET
    contract_number = p_contract_data->>'contract_number',
    contract_name = p_contract_data->>'contract_name',
    description = p_contract_data->>'description',
    start_date = (p_contract_data->>'start_date')::DATE,
    end_date = (p_contract_data->>'end_date')::DATE,
    signed_date = NULLIF(p_contract_data->>'signed_date', '')::DATE,
    status = p_contract_data->>'status',
    auto_renew = COALESCE((p_contract_data->>'auto_renew')::BOOLEAN, FALSE),
    renewal_period_months = NULLIF(p_contract_data->>'renewal_period_months', '')::INTEGER,
    expiry_notification_days = COALESCE((p_contract_data->>'expiry_notification_days')::INTEGER, 30),
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
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_contract_with_items TO authenticated;