-- Create a stored procedure to atomically create a contract with its items
CREATE OR REPLACE FUNCTION create_contract_with_items(
  p_contract_data jsonb,
  p_contract_items jsonb[],
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract_id uuid;
  v_contract_record jsonb;
  v_item jsonb;
BEGIN
  -- Insert the contract
  INSERT INTO customer_contracts (
    customer_id,
    organization_id,
    contract_number,
    contract_name,
    description,
    start_date,
    end_date,
    signed_date,
    status,
    auto_renew,
    renewal_period_months,
    expiry_notification_days,
    document_url,
    created_by
  )
  VALUES (
    (p_contract_data->>'customer_id')::uuid,
    p_organization_id,
    p_contract_data->>'contract_number',
    p_contract_data->>'contract_name',
    p_contract_data->>'description',
    (p_contract_data->>'start_date')::date,
    (p_contract_data->>'end_date')::date,
    CASE 
      WHEN p_contract_data->>'signed_date' IS NOT NULL 
      THEN (p_contract_data->>'signed_date')::date 
      ELSE NULL 
    END,
    COALESCE(p_contract_data->>'status', 'draft'),
    COALESCE((p_contract_data->>'auto_renew')::boolean, false),
    COALESCE((p_contract_data->>'renewal_period_months')::integer, 12),
    COALESCE((p_contract_data->>'expiry_notification_days')::integer, 30),
    p_contract_data->>'document_url',
    p_user_id
  )
  RETURNING id INTO v_contract_id;

  -- Insert contract items if any
  IF array_length(p_contract_items, 1) > 0 THEN
    FOREACH v_item IN ARRAY p_contract_items
    LOOP
      -- Validate required fields
      IF v_item->>'product_id' IS NULL OR v_item->>'contract_price' IS NULL THEN
        RAISE EXCEPTION 'Invalid contract item: missing required fields';
      END IF;

      -- Validate contract price is not negative
      IF (v_item->>'contract_price')::numeric < 0 THEN
        RAISE EXCEPTION 'Invalid contract item: contract price cannot be negative';
      END IF;

      INSERT INTO contract_items (
        contract_id,
        organization_id,
        product_id,
        contract_price,
        min_quantity,
        max_quantity,
        price_locked,
        notes
      )
      VALUES (
        v_contract_id,
        p_organization_id,
        (v_item->>'product_id')::uuid,
        (v_item->>'contract_price')::numeric,
        COALESCE((v_item->>'min_quantity')::integer, 1),
        (v_item->>'max_quantity')::integer,
        COALESCE((v_item->>'price_locked')::boolean, false),
        v_item->>'notes'
      );
    END LOOP;
  END IF;

  -- Return the created contract with its items
  SELECT jsonb_build_object(
    'id', cc.id,
    'customer_id', cc.customer_id,
    'organization_id', cc.organization_id,
    'contract_number', cc.contract_number,
    'contract_name', cc.contract_name,
    'description', cc.description,
    'start_date', cc.start_date,
    'end_date', cc.end_date,
    'signed_date', cc.signed_date,
    'status', cc.status,
    'auto_renew', cc.auto_renew,
    'renewal_period_months', cc.renewal_period_months,
    'expiry_notification_days', cc.expiry_notification_days,
    'document_url', cc.document_url,
    'created_at', cc.created_at,
    'created_by', cc.created_by,
    'contract_items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ci.id,
            'contract_id', ci.contract_id,
            'product_id', ci.product_id,
            'contract_price', ci.contract_price,
            'min_quantity', ci.min_quantity,
            'max_quantity', ci.max_quantity,
            'price_locked', ci.price_locked,
            'notes', ci.notes
          )
        )
        FROM contract_items ci
        WHERE ci.contract_id = cc.id
      ),
      '[]'::jsonb
    )
  ) INTO v_contract_record
  FROM customer_contracts cc
  WHERE cc.id = v_contract_id;

  RETURN v_contract_record;

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will automatically rollback
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_contract_with_items TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_contract_with_items IS 'Atomically creates a contract with its items in a single transaction';