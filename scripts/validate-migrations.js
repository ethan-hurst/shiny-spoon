#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs').promises
const path = require('path')

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

// Check if table exists and has expected structure
async function validateTable(supabase, tableName, expectedColumns = []) {
  console.log(`${colors.blue}Checking table: ${tableName}${colors.reset}`)

  try {
    // Try to query the table
    const { data, error } = await supabase.from(tableName).select('*').limit(0)

    if (error) {
      return {
        success: false,
        error: `Table '${tableName}' validation failed: ${error.message}`,
      }
    }

    // If expectedColumns provided, could add column validation here
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: `Table '${tableName}' validation failed: ${error.message}`,
    }
  }
}

// Check if RLS is enabled on table
async function checkRLSEnabled(supabase, tableName) {
  console.log(
    `${colors.blue}Checking RLS for table: ${tableName}${colors.reset}`
  )

  try {
    const { data, error } = await supabase.rpc('check_table_rls_enabled', {
      table_name: tableName,
    })

    if (error) {
      // Check for specific PostgreSQL error code for missing function (42883)
      // or check the error code property instead of message text
      if (
        error.code === '42883' ||
        error.details?.includes('function') ||
        error.message.includes('does not exist')
      ) {
        await createRLSCheckFunction(supabase)
        // Retry
        const { data: retryData, error: retryError } = await supabase.rpc(
          'check_table_rls_enabled',
          {
            table_name: tableName,
          }
        )

        if (retryError) {
          return {
            success: false,
            error: `RLS check failed: ${retryError.message}`,
          }
        }

        return { success: retryData === true }
      }

      return { success: false, error: `RLS check failed: ${error.message}` }
    }

    return { success: data === true }
  } catch (error) {
    return { success: false, error: `RLS check failed: ${error.message}` }
  }
}

// Create RLS check function if it doesn't exist
async function createRLSCheckFunction(supabase) {
  // Instead of exec_sql, we should pre-create this function in a migration
  // For now, we'll skip the creation and assume it exists or log an error
  console.error(
    'RLS check function does not exist. Please create it via migration.'
  )
  console.log('Migration needed:')
  console.log(`
    CREATE OR REPLACE FUNCTION check_table_rls_enabled(table_name text)
    RETURNS boolean AS $$
    DECLARE
      rls_enabled boolean;
    BEGIN
      -- Input validation to prevent SQL injection
      IF table_name IS NULL OR table_name = '' THEN
        RAISE EXCEPTION 'Table name cannot be null or empty';
      END IF;
      
      -- Only allow alphanumeric characters and underscores
      IF table_name !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid table name format';
      END IF;
      
      SELECT relrowsecurity INTO rls_enabled
      FROM pg_class
      WHERE relname = table_name
      AND relnamespace = 'public'::regnamespace;
      
      RETURN COALESCE(rls_enabled, false);
    END;
    $$ LANGUAGE plpgsql STABLE;
  `)

  throw new Error('RLS check function must be created via migration')
}

// Check if migrations directory exists
async function checkMigrationsDirectory() {
  const migrationsPath = path.join(process.cwd(), 'supabase', 'migrations')

  try {
    const stats = await fs.stat(migrationsPath)
    if (!stats.isDirectory()) {
      return { success: false, error: 'Migrations path is not a directory' }
    }

    const files = await fs.readdir(migrationsPath)
    const sqlFiles = files.filter((f) => f.endsWith('.sql'))

    if (sqlFiles.length === 0) {
      return { success: false, error: 'No migration files found' }
    }

    return { success: true, migrations: sqlFiles }
  } catch (error) {
    return { success: false, error: 'Migrations directory not found' }
  }
}

// Main validation function
async function validateMigrations() {
  console.log(
    `${colors.yellow}🔍 Running PRP-002 Migration Validation...${colors.reset}\n`
  )

  const results = []
  let allPassed = true

  // Check migrations directory
  console.log(
    `\n${colors.yellow}Checking migrations directory...${colors.reset}`
  )
  const dirCheck = await checkMigrationsDirectory()
  if (dirCheck.success) {
    console.log(
      `${colors.green}✅ Found ${dirCheck.migrations.length} migration files${colors.reset}`
    )
    results.push({ test: 'Migrations Directory', passed: true })
  } else {
    console.log(`${colors.red}❌ ${dirCheck.error}${colors.reset}`)
    results.push({
      test: 'Migrations Directory',
      passed: false,
      error: dirCheck.error,
    })
    allPassed = false
  }

  // Initialize Supabase client
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch (error) {
    console.log(
      `${colors.red}❌ Failed to initialize Supabase client: ${error.message}${colors.reset}`
    )
    console.log(
      `${colors.yellow}Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set${colors.reset}`
    )
    process.exit(1)
  }

  // Core tables to validate
  const coreTables = [
    'organizations',
    'user_profiles',
    'products',
    'warehouses',
    'inventory',
    'inventory_adjustments',
    'customers',
    'customer_tiers',
    'pricing_rules',
    'product_pricing',
    'customer_pricing',
    'quantity_breaks',
  ]

  // Validate each table exists
  console.log(`\n${colors.yellow}Validating tables...${colors.reset}`)
  for (const table of coreTables) {
    const result = await validateTable(supabase, table)
    if (result.success) {
      console.log(`${colors.green}✅ Table '${table}' exists${colors.reset}`)
      results.push({ test: `Table: ${table}`, passed: true })
    } else {
      console.log(`${colors.red}❌ ${result.error}${colors.reset}`)
      results.push({
        test: `Table: ${table}`,
        passed: false,
        error: result.error,
      })
      allPassed = false
    }
  }

  // Check RLS on critical tables
  console.log(`\n${colors.yellow}Checking RLS policies...${colors.reset}`)
  const rlsTables = [
    'organizations',
    'user_profiles',
    'products',
    'warehouses',
    'inventory',
    'customers',
    'pricing_rules',
    'customer_pricing',
  ]

  for (const table of rlsTables) {
    const result = await checkRLSEnabled(supabase, table)
    if (result.success) {
      console.log(`${colors.green}✅ RLS enabled on '${table}'${colors.reset}`)
      results.push({ test: `RLS: ${table}`, passed: true })
    } else {
      console.log(
        `${colors.red}❌ RLS not enabled on '${table}'${colors.reset}`
      )
      results.push({
        test: `RLS: ${table}`,
        passed: false,
        error: 'RLS not enabled',
      })
      allPassed = false
    }
  }

  // Check for seed data
  console.log(`\n${colors.yellow}Checking seed data...${colors.reset}`)
  const seedPath = path.join(process.cwd(), 'supabase', 'seed.sql')
  try {
    await fs.access(seedPath)
    console.log(`${colors.green}✅ Seed file exists${colors.reset}`)
    results.push({ test: 'Seed Data', passed: true })
  } catch {
    console.log(
      `${colors.yellow}⚠️  No seed.sql file found (optional)${colors.reset}`
    )
  }

  // Summary
  console.log('\n' + '═'.repeat(50))
  console.log(`${colors.yellow}MIGRATION VALIDATION SUMMARY${colors.reset}`)
  console.log('═'.repeat(50))

  const passedCount = results.filter((r) => r.passed).length
  const totalCount = results.length

  console.log(`Total Checks: ${totalCount}`)
  console.log(`Passed: ${colors.green}${passedCount}${colors.reset}`)
  console.log(`Failed: ${colors.red}${totalCount - passedCount}${colors.reset}`)

  if (allPassed) {
    console.log(
      `\n${colors.green}🎉 All PRP-002 migration validations passed!${colors.reset}`
    )
    process.exit(0)
  } else {
    console.log(
      `\n${colors.red}❌ Some migration validations failed.${colors.reset}`
    )

    // Show failed tests
    console.log(`\n${colors.red}Failed Checks:${colors.reset}`)
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.test}: ${r.error || 'Failed'}`)
      })

    console.log(`\n${colors.yellow}To fix RLS issues, run:${colors.reset}`)
    console.log(`  ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`)

    process.exit(1)
  }
}

// Run validation
validateMigrations().catch((error) => {
  console.error(
    `${colors.red}Validation script error: ${error.message}${colors.reset}`
  )
  process.exit(1)
})
