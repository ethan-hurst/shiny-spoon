-- Fix Migration State
-- Run this in your Supabase SQL Editor to reset migration state

-- Option 1: Clear all migration state (nuclear option)
DELETE FROM supabase_migrations.schema_migrations;

-- Option 2: Remove specific problematic migrations
DELETE FROM supabase_migrations.schema_migrations 
WHERE version IN ('004', '005', '006', '007', '008', '010', '011', '012');

-- Option 3: Check current migration state
SELECT version, name, statements 
FROM supabase_migrations.schema_migrations 
ORDER BY version;

-- Option 4: Reset to known good state (only keep 001_initial_schema)
DELETE FROM supabase_migrations.schema_migrations 
WHERE version != '001';

-- After running one of the above, try:
-- supabase db push 