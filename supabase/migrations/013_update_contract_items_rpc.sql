-- PRP-016A: Create RPC function for atomic contract items update

-- Function to atomically update contract items
CREATE OR REPLACE FUNCTION update_contract_items(
  p_contract_id UUID,
  p_items JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing items
  DELETE FROM contract_items
  WHERE contract_id = p_contract_id;
  
  -- Insert new items if provided
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
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
    FROM jsonb_array_elements(p_items) AS item;
  END IF;
END;
$$;