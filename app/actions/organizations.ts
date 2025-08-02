'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'

export async function createOrganization(data: {
  name: string
  tier: 'free' | 'starter' | 'professional' | 'enterprise'
}) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user already belongs to an organization
    if (user.organizationId) {
      return { success: false, error: 'You already belong to an organization' }
    }

    const supabase = createServerClient()

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        settings: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: 'USD',
        },
      })
      .select()
      .single()

    if (orgError) {
      console.error('Organization creation error:', orgError)
      return { success: false, error: 'Failed to create organization' }
    }

    // Set tenant limits based on tier
    const { error: limitsError } = await supabase
      .from('tenant_limits')
      .insert({
        organization_id: org.id,
        tier: data.tier,
        max_connections: data.tier === 'free' ? 10 : data.tier === 'starter' ? 25 : data.tier === 'professional' ? 100 : 500,
        max_api_calls_per_hour: data.tier === 'free' ? 1000 : data.tier === 'starter' ? 10000 : data.tier === 'professional' ? 100000 : 1000000,
        max_storage_gb: data.tier === 'free' ? 1 : data.tier === 'starter' ? 10 : data.tier === 'professional' ? 100 : 1000,
        max_users: data.tier === 'free' ? 5 : data.tier === 'starter' ? 25 : data.tier === 'professional' ? 100 : 1000,
      })

    if (limitsError) {
      console.error('Tenant limits error:', limitsError)
    }

    // Update user profile with organization and role
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        organization_id: org.id,
        role: 'owner', // Creator becomes owner
      })
      .eq('user_id', user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      return { success: false, error: 'Failed to update user profile' }
    }

    // Create default warehouse
    const { error: warehouseError } = await supabase
      .from('warehouses')
      .insert({
        organization_id: org.id,
        name: 'Main Warehouse',
        code: 'MAIN',
        address: '',
        is_active: true,
      })

    if (warehouseError) {
      console.error('Warehouse creation error:', warehouseError)
    }

    revalidatePath('/')
    return { success: true, organizationId: org.id }
  } catch (error) {
    console.error('Create organization error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function joinOrganization(inviteCode: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user already belongs to an organization
    if (user.organizationId) {
      return { success: false, error: 'You already belong to an organization' }
    }

    const supabase = createServerClient()

    // Find organization by invite code
    const { data: invite, error: inviteError } = await supabase
      .from('organization_invites')
      .select('*, organizations(*)')
      .eq('code', inviteCode)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invite) {
      return { success: false, error: 'Invalid or expired invite code' }
    }

    // Check if organization has reached user limit
    const { data: orgLimits } = await supabase
      .from('tenant_limits')
      .select('max_users')
      .eq('organization_id', invite.organization_id)
      .single()

    const { count: userCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', invite.organization_id)

    if (orgLimits && userCount && userCount >= orgLimits.max_users) {
      return { success: false, error: 'Organization has reached its user limit' }
    }

    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        organization_id: invite.organization_id,
        role: invite.role || 'member',
      })
      .eq('user_id', user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      return { success: false, error: 'Failed to join organization' }
    }

    // Update invite usage
    const { error: updateError } = await supabase
      .from('organization_invites')
      .update({
        used_by: user.id,
        used_at: new Date().toISOString(),
        is_active: invite.max_uses ? invite.uses_count + 1 >= invite.max_uses ? false : true : true,
        uses_count: invite.uses_count + 1,
      })
      .eq('id', invite.id)

    if (updateError) {
      console.error('Invite update error:', updateError)
    }

    revalidatePath('/')
    return { success: true, organizationId: invite.organization_id }
  } catch (error) {
    console.error('Join organization error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function createInviteCode(data: {
  role: 'admin' | 'member' | 'viewer'
  maxUses?: number
  expiresInDays?: number
}) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.organizationId) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is admin or owner
    if (user.role !== 'admin' && user.role !== 'owner') {
      return { success: false, error: 'Only admins can create invite codes' }
    }

    const supabase = createServerClient()

    // Generate a 6-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7))

    const { data: invite, error } = await supabase
      .from('organization_invites')
      .insert({
        organization_id: user.organizationId,
        code,
        role: data.role,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        max_uses: data.maxUses,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Invite creation error:', error)
      return { success: false, error: 'Failed to create invite code' }
    }

    return { success: true, code: invite.code, expiresAt: invite.expires_at }
  } catch (error) {
    console.error('Create invite error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}