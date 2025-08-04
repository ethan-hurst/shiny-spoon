-- Migration Cleanup Script
-- Run this to identify duplicate migrations

-- Check for duplicate tables
SELECT 
  table_name,
  COUNT(*) as definition_count
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('audit_logs', 'analytics_metrics', 'api_keys', 'performance_metrics')
GROUP BY table_name
HAVING COUNT(*) > 1;

-- Check for duplicate functions
SELECT 
  proname as function_name,
  COUNT(*) as definition_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname IN ('update_updated_at', 'update_updated_at_column')
GROUP BY proname
HAVING COUNT(*) > 1; 