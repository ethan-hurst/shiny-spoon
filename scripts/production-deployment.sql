-- Production Deployment Script
-- This script includes additional important fixes and best practices
-- Run this after applying the consolidated migrations

-- =============================================
-- ADDITIONAL IMPORTANT FIXES
-- =============================================

-- 1. Add missing constraints and validations
DO $$
BEGIN
  -- Add constraint to products if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_positive_prices'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT check_positive_prices 
    CHECK (base_price >= 0 AND cost >= 0);
  END IF;
  
  -- Add constraint to inventory if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_positive_quantities'
  ) THEN
    ALTER TABLE inventory ADD CONSTRAINT check_positive_quantities 
    CHECK (quantity >= 0 AND reserved_quantity >= 0);
  END IF;
END $$;

-- 2. Add data validation functions
CREATE OR REPLACE FUNCTION validate_sku_format(sku TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Ensure SKU is alphanumeric and not empty
  RETURN sku IS NOT NULL 
    AND LENGTH(TRIM(sku)) > 0 
    AND sku ~ '^[A-Za-z0-9\-_]+$';
END;
$$ LANGUAGE plpgsql;

-- 3. Add organization slug validation
CREATE OR REPLACE FUNCTION validate_organization_slug(slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Ensure slug is lowercase, alphanumeric with hyphens only
  RETURN slug IS NOT NULL 
    AND LENGTH(TRIM(slug)) > 0 
    AND slug ~ '^[a-z0-9\-]+$'
    AND NOT slug ~ '^-|-$'; -- No leading/trailing hyphens
END;
$$ LANGUAGE plpgsql;

-- 4. Add data integrity triggers
CREATE OR REPLACE FUNCTION validate_product_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate SKU format
  IF NOT validate_sku_format(NEW.sku) THEN
    RAISE EXCEPTION 'Invalid SKU format. Must be alphanumeric with hyphens/underscores only.';
  END IF;
  
  -- Ensure product name is not empty
  IF NEW.name IS NULL OR LENGTH(TRIM(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'Product name cannot be empty.';
  END IF;
  
  -- Ensure prices are non-negative
  IF NEW.base_price < 0 OR NEW.cost < 0 THEN
    RAISE EXCEPTION 'Prices must be non-negative.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add validation trigger to products
DROP TRIGGER IF EXISTS validate_product_data_trigger ON products;
CREATE TRIGGER validate_product_data_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_product_data();

-- 5. Add organization validation
CREATE OR REPLACE FUNCTION validate_organization_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate slug format
  IF NOT validate_organization_slug(NEW.slug) THEN
    RAISE EXCEPTION 'Invalid organization slug format.';
  END IF;
  
  -- Ensure organization name is not empty
  IF NEW.name IS NULL OR LENGTH(TRIM(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'Organization name cannot be empty.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add validation trigger to organizations
DROP TRIGGER IF EXISTS validate_organization_data_trigger ON organizations;
CREATE TRIGGER validate_organization_data_trigger
  BEFORE INSERT OR UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION validate_organization_data();

-- 6. Add performance optimizations
-- Create partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_active_org ON products(organization_id, active) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_inventory_low_stock_org ON inventory(organization_id, warehouse_id) 
WHERE quantity <= reorder_point;

-- Note: Removed time-based partial index as NOW() is not IMMUTABLE
-- Regular index on created_at will provide good performance for recent queries

-- 7. Add data retention policies
-- Create function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  audit_deleted INTEGER;
  access_deleted INTEGER;
  api_deleted INTEGER;
  error_deleted INTEGER;
BEGIN
  -- Clean up old audit logs (keep 1 year)
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '1 year';
  GET DIAGNOSTICS audit_deleted = ROW_COUNT;
  
  -- Clean up old access logs (keep 6 months)
  DELETE FROM access_logs 
  WHERE timestamp < NOW() - INTERVAL '6 months';
  GET DIAGNOSTICS access_deleted = ROW_COUNT;
  
  -- Clean up old API key usage (keep 3 months)
  DELETE FROM api_key_usage 
  WHERE timestamp < NOW() - INTERVAL '3 months';
  GET DIAGNOSTICS api_deleted = ROW_COUNT;
  
  -- Clean up old error logs (keep 1 month)
  DELETE FROM error_logs 
  WHERE created_at < NOW() - INTERVAL '1 month';
  GET DIAGNOSTICS error_deleted = ROW_COUNT;
  
  -- Calculate total deleted
  deleted_count := audit_deleted + access_deleted + api_deleted + error_deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add monitoring functions
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_organizations', (SELECT COUNT(*) FROM organizations),
    'total_users', (SELECT COUNT(*) FROM user_profiles),
    'total_products', (SELECT COUNT(*) FROM products),
    'total_inventory_items', (SELECT COUNT(*) FROM inventory),
    'total_audit_logs', (SELECT COUNT(*) FROM audit_logs),
    'total_api_keys', (SELECT COUNT(*) FROM api_keys),
    'recent_errors', (
      SELECT COUNT(*) FROM error_logs 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    ),
    'low_stock_items', (
      SELECT COUNT(*) FROM inventory 
      WHERE quantity <= reorder_point
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Add security enhancements
-- Create function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
  p_organization_id UUID,
  p_ip_address TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  recent_attempts INTEGER;
  failed_attempts INTEGER;
BEGIN
  -- Check for too many recent requests
  SELECT COUNT(*) INTO recent_attempts
  FROM access_logs
  WHERE organization_id = p_organization_id
    AND ip_address = p_ip_address
    AND timestamp >= NOW() - INTERVAL '1 minute';
  
  -- Check for failed authentication attempts
  SELECT COUNT(*) INTO failed_attempts
  FROM access_logs
  WHERE organization_id = p_organization_id
    AND ip_address = p_ip_address
    AND status_code IN (401, 403)
    AND timestamp >= NOW() - INTERVAL '1 hour';
  
  -- Return true if suspicious activity detected
  RETURN recent_attempts > 100 OR failed_attempts > 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add data export functions for compliance
CREATE OR REPLACE FUNCTION export_organization_data(p_org_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'organization', (
      SELECT row_to_json(o) FROM organizations o WHERE id = p_org_id
    ),
    'users', (
      SELECT json_agg(row_to_json(up)) 
      FROM user_profiles up 
      WHERE organization_id = p_org_id
    ),
    'products', (
      SELECT json_agg(row_to_json(p)) 
      FROM products p 
      WHERE organization_id = p_org_id
    ),
    'inventory', (
      SELECT json_agg(row_to_json(i)) 
      FROM inventory i 
      WHERE organization_id = p_org_id
    ),
    'audit_logs', (
      SELECT json_agg(row_to_json(al)) 
      FROM audit_logs al 
      WHERE organization_id = p_org_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Add backup verification functions
CREATE OR REPLACE FUNCTION verify_data_integrity()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'orphaned_inventory', (
      SELECT COUNT(*) FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE p.id IS NULL
    ),
    'orphaned_user_profiles', (
      SELECT COUNT(*) FROM user_profiles up
      LEFT JOIN organizations o ON up.organization_id = o.id
      WHERE o.id IS NULL
    ),
    'duplicate_skus', (
      SELECT COUNT(*) FROM (
        SELECT organization_id, sku, COUNT(*)
        FROM products
        GROUP BY organization_id, sku
        HAVING COUNT(*) > 1
      ) dupes
    ),
    'negative_quantities', (
      SELECT COUNT(*) FROM inventory
      WHERE quantity < 0 OR reserved_quantity < 0
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Grant permissions for new functions
GRANT EXECUTE ON FUNCTION validate_sku_format(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_organization_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_product_data() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_organization_data() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_data() TO service_role;
GRANT EXECUTE ON FUNCTION get_database_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION detect_suspicious_activity(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION export_organization_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_data_integrity() TO authenticated;

-- 13. Add comments for documentation
COMMENT ON FUNCTION validate_sku_format(TEXT) IS 'Validates SKU format for products';
COMMENT ON FUNCTION validate_organization_slug(TEXT) IS 'Validates organization slug format';
COMMENT ON FUNCTION validate_product_data() IS 'Validates product data before insert/update';
COMMENT ON FUNCTION validate_organization_data() IS 'Validates organization data before insert/update';
COMMENT ON FUNCTION cleanup_old_data() IS 'Cleans up old data based on retention policies';
COMMENT ON FUNCTION get_database_stats() IS 'Returns database statistics for monitoring';
COMMENT ON FUNCTION detect_suspicious_activity(UUID, TEXT, UUID) IS 'Detects suspicious activity for security';
COMMENT ON FUNCTION export_organization_data(UUID) IS 'Exports organization data for compliance';
COMMENT ON FUNCTION verify_data_integrity() IS 'Verifies data integrity and reports issues';

-- 14. Create scheduled cleanup job (requires pg_cron extension)
-- Uncomment if pg_cron is available
/*
SELECT cron.schedule(
  'cleanup-old-data',
  '0 2 * * *', -- Daily at 2 AM
  'SELECT cleanup_old_data();'
);
*/

-- 15. Final verification
DO $$
BEGIN
  -- Verify core tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    RAISE EXCEPTION 'Core tables not found. Run migrations first.';
  END IF;
  
  -- Verify functions exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    RAISE EXCEPTION 'Core functions not found. Run migrations first.';
  END IF;
  
  RAISE NOTICE 'Production deployment completed successfully!';
END $$; 