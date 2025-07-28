-- PRP-017B: Add authorization checks to update_contract_items SECURITY DEFINER function

-- Drop the existing function first
DROP FUNCTION IF EXISTS update_contract_items(UUID, JSONB);

-- Function to atomically update contract items with validation and authorization
CREATE OR REPLACE FUNCTION update_contract_items(
  p_contract_id UUID,
  p_items JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_price DECIMAL(10,2);
  v_min_quantity INTEGER;
  v_max_quantity INTEGER;
  v_user_id UUID;
  v_user_org_id UUID;
  v_contract_org_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Get user's organization
  SELECT organization_id INTO v_user_org_id
  FROM user_profiles
  WHERE user_id = v_user_id;
  
  IF v_user_org_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to an organization';
  END IF;
  
  -- Validate p_contract_id parameter
  IF p_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract ID cannot be null';
  END IF;
  
  -- Check if contract exists and get its organization
  SELECT organization_id INTO v_contract_org_id
  FROM customer_contracts
  WHERE id = p_contract_id;
  
  IF v_contract_org_id IS NULL THEN
    RAISE EXCEPTION 'Contract with ID % not found', p_contract_id;
  END IF;
  
  -- Verify user has access to this contract (same organization)
  IF v_contract_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'Access denied: Contract belongs to a different organization';
  END IF;
  
  -- Validate JSONB structure if items are provided
  IF p_items IS NOT NULL THEN
    -- Check if p_items is an array
    IF jsonb_typeof(p_items) != 'array' THEN
      RAISE EXCEPTION 'Items must be a JSON array';
    END IF;
    
    -- Validate each item in the array
    FOR v_item IN SELECT jsonb_array_elements(p_items)
    LOOP
      -- Check required fields exist
      IF NOT (v_item ? 'product_id' AND v_item ? 'price' AND v_item ? 'min_quantity') THEN
        RAISE EXCEPTION 'Each item must have product_id, price, and min_quantity fields';
      END IF;
      
      -- Validate product_id is a valid UUID
      BEGIN
        v_product_id := (v_item->>'product_id')::UUID;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Invalid product_id UUID format: %', v_item->>'product_id';
      END;
      
      -- Validate price is a valid decimal
      BEGIN
        v_price := (v_item->>'price')::DECIMAL(10,2);
      EXCEPTION
        WHEN numeric_value_out_of_range OR invalid_text_representation THEN
          RAISE EXCEPTION 'Invalid price format: %', v_item->>'price';
      END;
      
      -- Check non-negativity after successful cast
      IF v_price < 0 THEN
        RAISE EXCEPTION 'Price cannot be negative: %', v_price;
      END IF;
      
      -- Validate min_quantity is a valid integer
      BEGIN
        v_min_quantity := (v_item->>'min_quantity')::INTEGER;
      EXCEPTION
        WHEN numeric_value_out_of_range OR invalid_text_representation THEN
          RAISE EXCEPTION 'Invalid min_quantity format: %', v_item->>'min_quantity';
      END;
      
      -- Check min quantity validation after successful cast
      IF v_min_quantity < 1 THEN
        RAISE EXCEPTION 'Min quantity must be at least 1: %', v_min_quantity;
      END IF;
      
      -- Validate max_quantity if provided
      IF v_item ? 'max_quantity' AND v_item->>'max_quantity' != '' AND v_item->>'max_quantity' IS NOT NULL THEN
        BEGIN
          v_max_quantity := (v_item->>'max_quantity')::INTEGER;
        EXCEPTION
          WHEN numeric_value_out_of_range OR invalid_text_representation THEN
            RAISE EXCEPTION 'Invalid max_quantity format: %', v_item->>'max_quantity';
        END;
        
        -- Check max vs min after successful cast
        IF v_max_quantity < v_min_quantity THEN
          RAISE EXCEPTION 'Max quantity (%) must be greater than or equal to min quantity (%)', v_max_quantity, v_min_quantity;
        END IF;
      END IF;
      
      -- Check if product exists and belongs to the same organization
      IF NOT EXISTS (
        SELECT 1 FROM products 
        WHERE id = v_product_id 
        AND organization_id = v_user_org_id
      ) THEN
        RAISE EXCEPTION 'Product with ID % not found or access denied', v_product_id;
      END IF;
    END LOOP;
  END IF;
  
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

-- Add comment for documentation
COMMENT ON FUNCTION update_contract_items(UUID, JSONB) IS 
'Atomically updates contract items with comprehensive validation and authorization. 
Validates user authentication, organization access, JSONB structure, data types, and referential integrity before making changes.
Only users from the same organization as the contract can update its items.';