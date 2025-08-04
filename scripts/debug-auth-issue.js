#!/usr/bin/env node

/**
 * Debug script to identify authentication issues
 * This script helps diagnose what's causing the login problems
 */

const { createClient } = require('@supabase/supabase-js')

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkCurrentPolicies() {
  console.log('🔍 Checking current RLS policies...')
  
  try {
    // Check what policies exist on user_profiles
    const { data: policies, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1)
    
    if (error) {
      console.log('   ❌ Error accessing user_profiles:', error.message)
      console.log('   🔍 Error code:', error.code)
      console.log('   🔍 Error details:', error.details)
      return false
    } else {
      console.log('   ✅ user_profiles table is accessible')
      return true
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    return false
  }
}

async function testUserProfileAccess() {
  console.log('\n🧪 Testing user profile access...')
  
  try {
    // Test with a dummy user ID to see what happens
    const testUserId = '00000000-0000-0000-0000-000000000000'
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, user_id, organization_id, role')
      .eq('user_id', testUserId)
      .single()
    
    if (error) {
      console.log('   ⚠️  Expected error for non-existent user:', error.message)
      console.log('   🔍 Error code:', error.code)
      
      // Check if it's a "no rows" error (PGRST116)
      if (error.code === 'PGRST116') {
        console.log('   ✅ This is expected - no user profile found')
        return true
      } else {
        console.log('   ❌ Unexpected error code')
        return false
      }
    } else {
      console.log('   ⚠️  Unexpected success for non-existent user')
      return false
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    return false
  }
}

async function checkHelperFunctions() {
  console.log('\n🔧 Checking helper functions...')
  
  try {
    // Test the get_user_organization_id function
    const testUserId = '00000000-0000-0000-0000-000000000000'
    
    const { data, error } = await supabase
      .rpc('get_user_organization_id', { user_uuid: testUserId })
    
    if (error) {
      console.log('   ⚠️  Function test (expected for invalid UUID):', error.message)
    } else {
      console.log('   ✅ Helper function is working')
    }
    
    return true
  } catch (error) {
    console.error('❌ Function test failed:', error.message)
    return false
  }
}

async function checkExistingUsers() {
  console.log('\n👥 Checking existing users...')
  
  try {
    // Try to get a count of user profiles
    const { count, error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.log('   ❌ Error counting users:', error.message)
      return false
    } else {
      console.log(`   ✅ Found ${count} user profiles`)
      return true
    }
  } catch (error) {
    console.error('❌ User count failed:', error.message)
    return false
  }
}

async function testAuthenticationFlow() {
  console.log('\n🔐 Testing authentication flow...')
  
  try {
    // Test the auth.getUser() function
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.log('   ⚠️  No authenticated user (expected):', error.message)
    } else if (user) {
      console.log('   ✅ Found authenticated user:', user.id)
      
      // Try to fetch this user's profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, user_id, organization_id, role')
        .eq('user_id', user.id)
        .single()
      
      if (profileError) {
        console.log('   ❌ Error fetching user profile:', profileError.message)
        console.log('   🔍 Profile error code:', profileError.code)
        return false
      } else {
        console.log('   ✅ User profile found:', profile)
        return true
      }
    } else {
      console.log('   ⚠️  No authenticated user found')
      return true
    }
  } catch (error) {
    console.error('❌ Auth flow test failed:', error.message)
    return false
  }
}

async function runDiagnostics() {
  console.log('🚀 Starting Authentication Diagnostics...\n')
  
  const results = {
    policies: await checkCurrentPolicies(),
    profileAccess: await testUserProfileAccess(),
    helperFunctions: await checkHelperFunctions(),
    existingUsers: await checkExistingUsers(),
    authFlow: await testAuthenticationFlow(),
  }
  
  console.log('\n📊 Diagnostic Results:')
  console.log(`   RLS Policies: ${results.policies ? '✅ OK' : '❌ FAIL'}`)
  console.log(`   Profile Access: ${results.profileAccess ? '✅ OK' : '❌ FAIL'}`)
  console.log(`   Helper Functions: ${results.helperFunctions ? '✅ OK' : '❌ FAIL'}`)
  console.log(`   Existing Users: ${results.existingUsers ? '✅ OK' : '❌ FAIL'}`)
  console.log(`   Auth Flow: ${results.authFlow ? '✅ OK' : '❌ FAIL'}`)
  
  const allPassed = Object.values(results).every(result => result === true)
  
  if (allPassed) {
    console.log('\n🎉 All diagnostics passed! The RLS fix appears to be working.')
    console.log('\n📝 Next steps:')
    console.log('   1. Test with a real user login')
    console.log('   2. Check application logs for any remaining issues')
    console.log('   3. Verify the setup page works for new users')
  } else {
    console.log('\n⚠️  Some diagnostics failed. Please check the database migration.')
    console.log('\n🔧 Recommended actions:')
    console.log('   1. Run the corrected RLS fix script')
    console.log('   2. Check Supabase dashboard for any errors')
    console.log('   3. Verify all policies were applied correctly')
  }
  
  return allPassed
}

// Run the diagnostics
runDiagnostics().catch(console.error) 