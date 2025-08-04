// Simple test to verify admin client works
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Missing')
console.log('Service Role Key:', serviceRoleKey ? 'Set' : 'Missing')

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, serviceRoleKey)

async function testAdminClient() {
  try {
    console.log('Testing admin client...')
    
    const { data, error } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', 'a46bd1d3-c881-467c-8b6e-b30752cae33d')
      .single()

    if (error) {
      console.error('Admin client error:', error)
    } else {
      console.log('Admin client success:', data)
    }
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testAdminClient() 