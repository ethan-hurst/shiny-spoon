-- Create RPC function for transactional NetSuite webhook processing
CREATE OR REPLACE FUNCTION process_netsuite_webhook(
  p_webhook_id UUID,
  p_integration_id UUID,
  p_organization_id UUID,
  p_event_type TEXT,
  p_record_data JSONB,
  p_event_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_product_id UUID;
  v_warehouse_id UUID;
  v_customer_id UUID;
  v_field_mappings JSONB;
BEGIN
  -- Start transaction implicitly
  
  -- Get field mappings from integration config
  SELECT 
    ic.config->'field_mappings'
  INTO v_field_mappings
  FROM integration_configs ic
  WHERE ic.integration_id = p_integration_id
  LIMIT 1;
  
  -- Set default empty object if field_mappings is null
  IF v_field_mappings IS NULL THEN
    v_field_mappings := '{}'::jsonb;
  END IF;

  -- Process based on event type
  CASE 
    WHEN p_event_type IN ('item.created', 'item.updated') THEN
      -- Transform and upsert product
      INSERT INTO products (
        organization_id,
        sku,
        name,
        description,
        price,
        weight,
        dimensions,
        is_active,
        external_id,
        metadata
      ) VALUES (
        p_organization_id,
        p_record_data->>'itemid',
        p_record_data->>'displayname',
        p_record_data->>'salesdescription',
        COALESCE((p_record_data->>'rate')::DECIMAL, 0),
        (p_record_data->'weight')::JSONB,
        (p_record_data->'dimensions')::JSONB,
        NOT COALESCE((p_record_data->>'isinactive')::BOOLEAN, false),
        p_record_data->>'id',
        jsonb_build_object(
          'source', 'netsuite',
          'last_webhook_sync', NOW(),
          'raw_data', p_record_data
        )
      )
      ON CONFLICT (organization_id, sku) 
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        weight = EXCLUDED.weight,
        dimensions = EXCLUDED.dimensions,
        is_active = EXCLUDED.is_active,
        external_id = EXCLUDED.external_id,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id INTO v_product_id;

    WHEN p_event_type = 'inventory.updated' THEN
      -- Get warehouse by external_id
      SELECT id INTO v_warehouse_id
      FROM warehouses
      WHERE organization_id = p_organization_id
        AND external_id = p_record_data->>'location'
      LIMIT 1;

      IF v_warehouse_id IS NOT NULL THEN
        -- Get product by SKU
        SELECT id INTO v_product_id
        FROM products
        WHERE organization_id = p_organization_id
          AND sku = p_record_data->>'item'
        LIMIT 1;

        IF v_product_id IS NOT NULL THEN
          -- Update inventory
          INSERT INTO inventory (
            organization_id,
            product_id,
            warehouse_id,
            quantity_on_hand,
            quantity_available,
            quantity_allocated,
            quantity_on_order,
            reserved_quantity,
            reorder_point,
            last_sync,
            sync_status
          ) VALUES (
            p_organization_id,
            v_product_id,
            v_warehouse_id,
            COALESCE((p_record_data->>'quantityonhand')::INTEGER, 0),
            COALESCE((p_record_data->>'quantityavailable')::INTEGER, 0),
            COALESCE((p_record_data->>'quantitycommitted')::INTEGER, 0),
            COALESCE((p_record_data->>'quantityonorder')::INTEGER, 0),
            COALESCE((p_record_data->>'quantitybackordered')::INTEGER, 0),
            COALESCE((p_record_data->>'reorderpoint')::INTEGER, 0),
            NOW(),
            'synced'
          )
          ON CONFLICT (organization_id, product_id, warehouse_id)
          DO UPDATE SET
            quantity_on_hand = EXCLUDED.quantity_on_hand,
            quantity_available = EXCLUDED.quantity_available,
            quantity_allocated = EXCLUDED.quantity_allocated,
            quantity_on_order = EXCLUDED.quantity_on_order,
            reserved_quantity = EXCLUDED.reserved_quantity,
            reorder_point = EXCLUDED.reorder_point,
            last_sync = EXCLUDED.last_sync,
            sync_status = EXCLUDED.sync_status,
            updated_at = NOW();
        END IF;
      END IF;

    WHEN p_event_type IN ('customer.created', 'customer.updated') THEN
      -- Transform and upsert customer
      INSERT INTO customers (
        organization_id,
        code,
        name,
        email,
        phone,
        is_active,
        credit_limit,
        balance,
        external_id,
        metadata
      ) VALUES (
        p_organization_id,
        p_record_data->>'entityid',
        p_record_data->>'companyname',
        p_record_data->>'email',
        p_record_data->>'phone',
        NOT COALESCE((p_record_data->>'isinactive')::BOOLEAN, false),
        COALESCE((p_record_data->>'creditlimit')::DECIMAL, 0),
        COALESCE((p_record_data->>'balance')::DECIMAL, 0),
        p_record_data->>'id',
        jsonb_build_object(
          'source', 'netsuite',
          'last_webhook_sync', NOW(),
          'raw_data', p_record_data
        )
      )
      ON CONFLICT (organization_id, code)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        is_active = EXCLUDED.is_active,
        credit_limit = EXCLUDED.credit_limit,
        balance = EXCLUDED.balance,
        external_id = EXCLUDED.external_id,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id INTO v_customer_id;

    WHEN p_event_type IN ('salesorder.created', 'salesorder.updated') THEN
      -- Log sales order activity
      INSERT INTO integration_activity_logs (
        integration_id,
        organization_id,
        log_type,
        severity,
        message,
        details,
        created_at
      ) VALUES (
        p_integration_id,
        p_organization_id,
        'webhook',
        'info',
        'Sales order ' || p_event_type,
        jsonb_build_object(
          'order_number', p_record_data->>'tranid',
          'status', p_record_data->>'orderstatus',
          'raw_data', p_record_data
        ),
        NOW()
      );

    ELSE
      -- Unknown event type
      RAISE EXCEPTION 'Unknown event type: %', p_event_type;
  END CASE;

  -- Mark webhook as processed
  UPDATE webhook_events
  SET 
    processed_at = NOW(),
    response_status = 200,
    updated_at = NOW()
  WHERE id = p_event_id;

  -- Update integration last sync timestamp
  UPDATE integrations
  SET 
    last_sync_at = NOW(),
    updated_at = NOW()
  WHERE id = p_integration_id;

  -- Return success
  v_result := jsonb_build_object(
    'success', true,
    'event_type', p_event_type,
    'processed_at', NOW()
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Mark webhook as failed on any error
    UPDATE webhook_events
    SET 
      error = SQLERRM,
      response_status = 500,
      updated_at = NOW()
    WHERE id = p_event_id;

    -- Re-raise the exception to rollback the transaction
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_netsuite_webhook TO authenticated;

-- Add comment
COMMENT ON FUNCTION process_netsuite_webhook IS 'Processes NetSuite webhook events atomically within a transaction, ensuring all updates succeed or fail together';