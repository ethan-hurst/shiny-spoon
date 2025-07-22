-- Stored procedure for bulk updating customer prices within a transaction
CREATE OR REPLACE FUNCTION bulk_update_customer_prices_transaction(
  p_customer_id UUID,
  p_updates JSONB,
  p_bulk_update_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_item JSONB;
  product_record RECORD;
  existing_pricing RECORD;
  result JSONB;
  total_count INTEGER;
  succeeded_count INTEGER := 0;
  errors JSONB[] := '{}';
  error_msg TEXT;
BEGIN
  -- Get total count
  SELECT json_array_length(p_updates::json) INTO total_count;
  
  -- Begin transaction (implicit in function)
  
  -- Process each update
  FOR update_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    BEGIN
      -- Find product by SKU
      SELECT p.id, pp.base_price, pp.cost 
      INTO product_record
      FROM products p
      LEFT JOIN product_pricing pp ON p.id = pp.product_id
      WHERE p.sku = (update_item->>'sku');
      
      IF NOT FOUND THEN
        errors := errors || jsonb_build_object(
          'sku', update_item->>'sku',
          'error', 'Product not found'
        );
        CONTINUE;
      END IF;
      
      -- Check if customer already has pricing for this product
      SELECT id INTO existing_pricing
      FROM customer_pricing
      WHERE customer_id = p_customer_id 
        AND product_id = product_record.id;
      
      IF FOUND THEN
        -- Update existing pricing
        UPDATE customer_pricing SET
          override_price = CASE 
            WHEN update_item->>'price' IS NOT NULL 
            THEN (update_item->>'price')::NUMERIC 
            ELSE override_price 
          END,
          override_discount_percent = CASE 
            WHEN update_item->>'discount_percent' IS NOT NULL 
            THEN (update_item->>'discount_percent')::NUMERIC 
            ELSE override_discount_percent 
          END,
          bulk_update_id = p_bulk_update_id,
          import_notes = update_item->>'reason',
          updated_at = NOW(),
          updated_by = p_user_id
        WHERE id = existing_pricing.id;
      ELSE
        -- Create new pricing
        INSERT INTO customer_pricing (
          customer_id,
          product_id,
          override_price,
          override_discount_percent,
          bulk_update_id,
          import_notes,
          created_by
        ) VALUES (
          p_customer_id,
          product_record.id,
          CASE 
            WHEN update_item->>'price' IS NOT NULL 
            THEN (update_item->>'price')::NUMERIC 
            ELSE NULL 
          END,
          CASE 
            WHEN update_item->>'discount_percent' IS NOT NULL 
            THEN (update_item->>'discount_percent')::NUMERIC 
            ELSE NULL 
          END,
          p_bulk_update_id,
          update_item->>'reason',
          p_user_id
        );
      END IF;
      
      -- Add to history
      INSERT INTO customer_price_history (
        customer_id,
        product_id,
        old_price,
        new_price,
        old_discount_percent,
        new_discount_percent,
        change_type,
        change_reason,
        created_by
      ) VALUES (
        p_customer_id,
        product_record.id,
        product_record.base_price,
        CASE 
          WHEN update_item->>'price' IS NOT NULL 
          THEN (update_item->>'price')::NUMERIC 
          ELSE NULL 
        END,
        NULL, -- old_discount_percent
        CASE 
          WHEN update_item->>'discount_percent' IS NOT NULL 
          THEN (update_item->>'discount_percent')::NUMERIC 
          ELSE NULL 
        END,
        'bulk',
        update_item->>'reason',
        p_user_id
      );
      
      succeeded_count := succeeded_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
      errors := errors || jsonb_build_object(
        'sku', update_item->>'sku',
        'error', error_msg
      );
    END;
  END LOOP;
  
  -- Return results
  result := jsonb_build_object(
    'total', total_count,
    'succeeded', succeeded_count,
    'failed', array_length(errors, 1),
    'pending_approval', 0,
    'errors', array_to_json(errors),
    'bulk_update_id', p_bulk_update_id
  );
  
  RETURN result;
END;
$$;
