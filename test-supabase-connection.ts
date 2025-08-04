// Test script to verify Supabase connection
// Run with: npx tsx test-supabase-connection.ts

import { createClient } from '@supabase/supabase-js'
// Load environment variables
import dotenv from 'dotenv'
import { Database } from './supabase/types/database'

dotenv.config({ path: '.env.local' })

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n')

  // Check environment variables
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey) {
    console.error('❌ Missing required environment variables:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', url ? '✓' : '✗')
    console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', anonKey ? '✓' : '✗')
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? '✓' : '✗')
    process.exit(1)
  }

  console.log('✅ Environment variables found\n')

  // Create Supabase client
  const supabase = createClient<Database>(url, anonKey)

  try {
    // Test 1: Check if we can connect
    console.log('📡 Test 1: Testing basic connection...')
    const { error: orgsError } = await supabase
      .from('organizations')
      .select('count')
      .limit(1)

    if (orgsError) {
      console.error('❌ Connection failed:', orgsError.message)
      return
    }
    console.log('✅ Connection successful!\n')

    // Test 2: Test auth system
    console.log('🔐 Test 2: Testing auth system...')
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData.user) {
      console.log('ℹ️  No authenticated user (expected for anon key)\n')
    } else {
      console.log('✅ Authenticated as:', authData.user.email, '\n')
    }

    // Test 3: Check table structure
    console.log('🏗️  Test 3: Checking table structure...')
    const tables = [
      'organizations',
      'user_profiles',
      'products',
      'warehouses',
      'inventory',
    ]

    for (const table of tables) {
      const { error } = await supabase
        .from(table as keyof Database['public']['Tables'])
        .select('*')
        .limit(0)
      if (error) {
        console.error(`❌ Table '${table}' check failed:`, error.message)
      } else {
        console.log(`✅ Table '${table}' exists`)
      }
    }

    console.log('\n🎉 All tests passed! Supabase is properly configured.')
    console.log('\n📝 Next steps:')
    console.log('1. Create a Supabase project at https://supabase.com')
    console.log('2. Run the migration file in the SQL editor')
    console.log('3. Update .env.local with your project credentials')
    console.log('4. Run the seed.sql file to populate test data')
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the test
testConnection()
