'use server'

import * as crypto from 'crypto'
import { Resend } from 'resend'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import type { Organization, UserProfile } from '@/types/auth.types'

// Validate Resend API key
if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is not set')
}

const resend = new Resend(process.env.RESEND_API_KEY)

// Type definitions
interface UserProfileWithOrganization extends UserProfile {
  organizations: Organization
}

interface CustomerBilling {
  id: string
  organization_id: string
  subscription_plan: 'starter' | 'growth' | 'scale'
  // Add other billing fields as needed
}

const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']),
  message: z.string().max(500).optional(),
})

const updateTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member']),
})

const removeTeamMemberSchema = z.object({
  userId: z.string().uuid(),
})

// Generate invitation token
function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export async function inviteTeamMember(formData: FormData) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = (await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .single()) as { data: UserProfileWithOrganization | null }

  if (
    !profile?.organization_id ||
    (profile.role !== 'admin' && profile.role !== 'owner')
  ) {
    throw new Error('Only admins and owners can invite team members')
  }

  const parsed = inviteTeamMemberSchema.parse({
    email: formData.get('email'),
    role: formData.get('role'),
    message: formData.get('message') || undefined,
  })

  // Since we can't query auth.users directly, we'll rely on team_invitations
  // and the fact that when a user accepts an invitation, they'll be added to user_profiles
  // For now, we just check if there's already a pending invitation

  // Check team size limits based on subscription
  const { count: memberCount } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)

  const { data: billing } = (await supabase
    .from('customer_billing')
    .select('subscription_plan')
    .eq('organization_id', profile.organization_id)
    .single()) as { data: CustomerBilling | null }

  type SubscriptionPlan = 'starter' | 'growth' | 'scale'

  const teamLimits: Record<SubscriptionPlan, number> = {
    starter: 3,
    growth: 10,
    scale: 50,
  }

  const plan = (billing?.subscription_plan || 'starter') as SubscriptionPlan
  const limit = teamLimits[plan] || 3
  if ((memberCount || 0) >= limit) {
    throw new Error(
      `Team member limit reached. Upgrade your plan to invite more members.`
    )
  }

  // Check for pending invitation
  const { data: existingInvite } = (await supabase
    .from('team_invitations')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .eq('email', parsed.email)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())
    .single()) as { data: { id: string } | null }

  if (existingInvite) {
    throw new Error('An invitation has already been sent to this email')
  }

  // Create invitation
  const token = generateInvitationToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

  const { data: invitation, error } = (await supabaseAdmin
    .from('team_invitations')
    .insert({
      organization_id: profile.organization_id,
      email: parsed.email,
      role: parsed.role,
      token,
      expires_at: expiresAt.toISOString(),
      invited_by: user.id,
      message: parsed.message,
    })
    .select()
    .single()) as { data: TeamInvitation | null; error: Error | null }

  if (error) throw error

  // Send invitation email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${token}`

  try {
    await resend.emails.send({
      from: 'TruthSource <team@truthsource.io>',
      to: parsed.email,
      subject: `You're invited to join ${profile.organizations.name} on TruthSource`,
      html: `
      <h2>You've been invited!</h2>
      <p>${user.email} has invited you to join ${profile.organizations.name} on TruthSource as a ${parsed.role}.</p>
      ${parsed.message ? `<p>Message from ${user.email}: ${parsed.message}</p>` : ''}
      <p>Click the link below to accept the invitation:</p>
      <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a>
      <p>This invitation will expire in 7 days.</p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    `,
    })
  } catch (emailError) {
    console.error('Failed to send invitation email:', emailError)
    // Delete the invitation if email fails
    await supabaseAdmin
      .from('team_invitations')
      .delete()
      .eq('id', invitation!.id)
    throw new Error('Failed to send invitation email. Please try again.')
  }

  return { success: true }
}

export async function updateTeamMember(formData: FormData) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = (await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()) as { data: Pick<UserProfile, 'organization_id' | 'role'> | null }

  if (
    !profile?.organization_id ||
    (profile.role !== 'admin' && profile.role !== 'owner')
  ) {
    throw new Error('Only admins and owners can update team members')
  }

  const parsed = updateTeamMemberSchema.parse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  })

  // Can't change your own role
  if (parsed.userId === user.id) {
    throw new Error('You cannot change your own role')
  }

  // Update member role
  const { error } = await supabase
    .from('user_profiles')
    .update({
      role: parsed.role,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', parsed.userId)
    .eq('organization_id', profile.organization_id)

  if (error) throw error

  return { success: true }
}

export async function removeTeamMember(formData: FormData) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = (await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()) as { data: Pick<UserProfile, 'organization_id' | 'role'> | null }

  if (
    !profile?.organization_id ||
    (profile.role !== 'admin' && profile.role !== 'owner')
  ) {
    throw new Error('Only admins and owners can remove team members')
  }

  const parsed = removeTeamMemberSchema.parse({
    userId: formData.get('userId'),
  })

  // Can't remove yourself
  if (parsed.userId === user.id) {
    throw new Error('You cannot remove yourself from the organization')
  }

  // Check if this is the last admin or owner
  const { count: adminCount } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .in('role', ['admin', 'owner'])

  if (adminCount === 1) {
    const { data: targetMember } = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', parsed.userId)
      .eq('organization_id', profile.organization_id)
      .single()) as { data: Pick<UserProfile, 'role'> | null }

    if (targetMember?.role === 'admin' || targetMember?.role === 'owner') {
      throw new Error(
        'Cannot remove the last admin/owner. Promote another member first.'
      )
    }
  }

  // Remove member from organization
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      organization_id: null,
      role: 'member',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', parsed.userId)
    .eq('organization_id', profile.organization_id)

  if (error) throw error

  return { success: true }
}

interface TeamInvitation {
  id: string
  organization_id: string
  email: string
  role: 'owner' | 'admin' | 'member'
  token: string
  message?: string | null
  expires_at: string
  accepted_at?: string | null
  invited_by: string
  created_at: string
  updated_at: string
}

export async function resendInvitation(invitationId: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = (await supabase
    .from('user_profiles')
    .select('organization_id, role, organizations(name)')
    .eq('user_id', user.id)
    .single()) as {
    data: {
      organization_id: string
      role: string
      organizations: { name: string }
    } | null
  }

  if (
    !profile?.organization_id ||
    (profile.role !== 'admin' && profile.role !== 'owner')
  ) {
    throw new Error('Only admins and owners can resend invitations')
  }

  // Get invitation
  const { data: invitation, error: inviteError } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (inviteError || !invitation) throw new Error('Invitation not found')

  const typedInvitation = invitation as TeamInvitation

  // Update expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  await supabaseAdmin
    .from('team_invitations')
    .update({
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitationId)

  // Resend email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${typedInvitation.token}`

  try {
    await resend.emails.send({
      from: 'TruthSource <team@truthsource.io>',
      to: typedInvitation.email,
      subject: `Reminder: You're invited to join ${profile.organizations.name} on TruthSource`,
      html: `
      <h2>Invitation Reminder</h2>
      <p>This is a reminder that you've been invited to join ${profile.organizations.name} on TruthSource as a ${typedInvitation.role}.</p>
      ${typedInvitation.message ? `<p>Message: ${typedInvitation.message}</p>` : ''}
      <p>Click the link below to accept the invitation:</p>
      <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a>
      <p>This invitation will expire in 7 days.</p>
    `,
    })
  } catch (emailError) {
    console.error('Failed to resend invitation email:', emailError)
    throw new Error('Failed to send invitation email. Please try again.')
  }

  return { success: true }
}

export async function cancelInvitation(invitationId: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = (await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()) as { data: Pick<UserProfile, 'organization_id' | 'role'> | null }

  if (
    !profile?.organization_id ||
    (profile.role !== 'admin' && profile.role !== 'owner')
  ) {
    throw new Error('Only admins and owners can cancel invitations')
  }

  // Soft delete invitation
  const { error } = await supabase
    .from('team_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('organization_id', profile.organization_id)
    .is('accepted_at', null)

  if (error) throw error

  return { success: true }
}
