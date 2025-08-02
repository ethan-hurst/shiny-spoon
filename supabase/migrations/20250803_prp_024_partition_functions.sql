-- Functions for partition management (PRP-024)

-- Function to get old partitions
CREATE OR REPLACE FUNCTION get_old_partitions(cutoff_date TIMESTAMPTZ)
RETURNS TABLE(table_name TEXT, created_date DATE) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_class.relname::TEXT as table_name,
    -- Extract date from partition name (tenant_usage_YYYY_MM)
    TO_DATE(
      SUBSTRING(pg_class.relname FROM 'tenant_usage_(\d{4}_\d{2})'),
      'YYYY_MM'
    ) as created_date
  FROM pg_class
  JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
  WHERE pg_class.relkind = 'r'  -- Regular tables
    AND pg_class.relname LIKE 'tenant_usage_%'
    AND pg_class.relname ~ 'tenant_usage_\d{4}_\d{2}$'  -- Match partition pattern
    AND TO_DATE(
      SUBSTRING(pg_class.relname FROM 'tenant_usage_(\d{4}_\d{2})'),
      'YYYY_MM'
    ) < DATE_TRUNC('month', cutoff_date)
    AND pg_namespace.nspname = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to drop a partition safely
CREATE OR REPLACE FUNCTION drop_partition(partition_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Validate partition name to prevent SQL injection
  IF partition_name !~ '^tenant_usage_\d{4}_\d{2}$' THEN
    RAISE EXCEPTION 'Invalid partition name: %', partition_name;
  END IF;
  
  -- Drop the partition
  EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', partition_name);
  
  RAISE NOTICE 'Dropped partition: %', partition_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to analyze tenant tables
CREATE OR REPLACE FUNCTION analyze_tenant_tables()
RETURNS VOID AS $$
DECLARE
  table_record RECORD;
BEGIN
  -- Analyze main tenant-related tables
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND (
      tablename IN ('products', 'inventory', 'orders', 'organizations', 'tenant_usage', 'tenant_limits')
      OR tablename LIKE 'tenant_usage_%'
    )
  LOOP
    EXECUTE format('ANALYZE %I', table_record.tablename);
  END LOOP;
  
  RAISE NOTICE 'Analyzed all tenant tables';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to vacuum tenant tables (non-blocking)
CREATE OR REPLACE FUNCTION vacuum_tenant_tables()
RETURNS VOID AS $$
DECLARE
  table_record RECORD;
BEGIN
  -- Vacuum main tenant-related tables (cannot run in transaction block)
  -- This function should be called separately or via pg_cron
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND (
      tablename IN ('tenant_usage', 'tenant_limits')
      OR tablename LIKE 'tenant_usage_%'
    )
  LOOP
    -- Note: VACUUM cannot be executed inside a transaction block
    -- This is mainly for documentation; actual VACUUM should be done via pg_cron
    RAISE NOTICE 'Table % needs vacuum', table_record.tablename;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get partition statistics
CREATE OR REPLACE FUNCTION get_partition_stats()
RETURNS TABLE(
  partition_name TEXT,
  row_count BIGINT,
  size_bytes BIGINT,
  created_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_class.relname::TEXT as partition_name,
    pg_class.reltuples::BIGINT as row_count,
    pg_total_relation_size(pg_class.oid)::BIGINT as size_bytes,
    TO_DATE(
      SUBSTRING(pg_class.relname FROM 'tenant_usage_(\d{4}_\d{2})'),
      'YYYY_MM'
    ) as created_date
  FROM pg_class
  JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
  WHERE pg_class.relkind = 'r'
    AND pg_class.relname LIKE 'tenant_usage_%'
    AND pg_class.relname ~ 'tenant_usage_\d{4}_\d{2}$'
    AND pg_namespace.nspname = 'public'
  ORDER BY created_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_monthly_partition() TO service_role;
GRANT EXECUTE ON FUNCTION get_old_partitions(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION drop_partition(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION analyze_tenant_tables() TO service_role;
GRANT EXECUTE ON FUNCTION vacuum_tenant_tables() TO service_role;
GRANT EXECUTE ON FUNCTION get_partition_stats() TO service_role;