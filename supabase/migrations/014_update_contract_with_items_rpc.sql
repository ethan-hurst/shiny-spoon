-- PRP-016: Add transaction protection to customer pricing contract updates

-- Function to atomically update contract and its items in a single transaction
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
    auto_renew = (p_contract_data->>'auto_renew')::BOOLEAN,
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