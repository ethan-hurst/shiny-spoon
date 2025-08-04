-- Reset Database to 100% Confidence
-- Run this in your Supabase SQL Editor

-- Step 1: Clear all migration state
DELETE FROM supabase_migrations.schema_migrations;

-- Step 2: Drop all tables (this will cascade to all dependent objects)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Step 3: Recreate the public schema with proper permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Step 4: Verify clean state
SELECT 
  'Migration State' as check_type,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '❌ Has Records' END as status
FROM supabase_migrations.schema_migrations;

SELECT 
  'Tables' as check_type,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '❌ Has Tables' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- After running this, your database will be completely fresh
-- Then run: supabase db push 