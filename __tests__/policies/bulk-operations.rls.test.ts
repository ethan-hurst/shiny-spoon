// @ts-nocheck
/**
 * RLS Policy Tests for bulk_operations & bulk_operation_records
 * Ensures tenant isolation and permitted write paths.
 * These tests rely on a test service role key and simulated JWT payloads for different users.
 * Adjust helper imports to your existing Supabase test utilities if present.
 */

import { createClient } from '@supabase/supabase-js'

// Environment-driven (CI should supply ephemeral project or local started instance)
const SUPABASE_URL = process.env.TEST_SUPABASE_URL as string
const SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY as string

if (!SUPABASE_URL || !SERVICE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Skipping RLS tests: TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY not set')
  // eslint-disable-next-line jest/no-focused-tests
  describe.skip('bulk operations RLS', () => it('skipped', () => {}))
} else {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

  async function impersonate(userId: string, orgId: string) {
    // Create a JWT via service key RPC if you have a helper, otherwise use supabase custom claims solution.
    // Here we assume a helper function exists or RLS policies rely on user_profiles lookup.
    return createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { 'x-test-user-id': userId, 'x-test-org-id': orgId } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  describe('bulk_operations RLS', () => {
    let org1User: string
    let org2User: string
    let org1Id: string
    let org2Id: string

    beforeAll(async () => {
      // Seed two orgs & users if not exist
      const { data: org1 } = await admin.from('organizations').insert({ name: 'RLS Org 1' }).select('*').single()
      const { data: org2 } = await admin.from('organizations').insert({ name: 'RLS Org 2' }).select('*').single()
      org1Id = org1.id
      org2Id = org2.id
      // Insert user profiles referencing orgs (assuming user_profiles table)
      const { data: u1 } = await admin
        .from('user_profiles')
        .insert({ organization_id: org1Id })
        .select('*')
        .single()
      const { data: u2 } = await admin
        .from('user_profiles')
        .insert({ organization_id: org2Id })
        .select('*')
        .single()
      org1User = u1.user_id
      org2User = u2.user_id
    })

    test('user can create operation in own org', async () => {
      const client = await impersonate(org1User, org1Id)
      const { data, error } = await client
        .from('bulk_operations')
        .insert({ organization_id: org1Id, operation_type: 'import', entity_type: 'products', status: 'pending', created_by: org1User })
        .select('*')
        .single()
      expect(error).toBeNull()
      expect(data?.organization_id).toBe(org1Id)
    })

    test('user cannot read other org operation', async () => {
      const client1 = await impersonate(org1User, org1Id)
      const client2 = await impersonate(org2User, org2Id)
      // Create op in org1
      const { data: op } = await client1
        .from('bulk_operations')
        .insert({ organization_id: org1Id, operation_type: 'import', entity_type: 'products', status: 'pending', created_by: org1User })
        .select('*')
        .single()
      // Attempt fetch from org2 user
      const { data, error } = await client2.from('bulk_operations').select('*').eq('id', op!.id).maybeSingle()
      expect(error).toBeNull()
      expect(data).toBeNull()
    })
  })
}
