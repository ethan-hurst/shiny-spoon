'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import crypto from 'crypto'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
  message: z.string().max(500).optional(),
})

const updateTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'member', 'viewer']),
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
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id || profile.role !== 'admin') {
    throw new Error('Only admins can invite team members')
  }

  const parsed = inviteTeamMemberSchema.parse({
    email: formData.get('email'),
    role: formData.get('role'),
    message: formData.get('message') || undefined,
  })

  // Check if user already exists in organization
  const { data: existingMember } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('organization_id', profile.organization_id)
    .eq('user_id', (
      await supabase.from('auth.users').select('id').eq('email', parsed.email).single()
    ).data?.id)
    .single()

  if (existingMember) {
    throw new Error('User is already a member of this organization')
  }

  // Check team size limits based on subscription
  const { data: memberCount } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)

  const { data: billing } = await supabase
    .from('customer_billing')
    .select('subscription_plan')
    .eq('organization_id', profile.organization_id)
    .single()

  const teamLimits: Record<string, number> = {
    starter: 3,
    growth: 10,
    scale: 50,
  }

  const limit = teamLimits[billing?.subscription_plan || 'starter'] || 3
  if ((memberCount?.count || 0) >= limit) {
    throw new Error(`Team member limit reached. Upgrade your plan to invite more members.`)
  }

  // Check for pending invitation
  const { data: existingInvite } = await supabase
    .from('team_invitations')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .eq('email', parsed.email)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())
    .single()

  if (existingInvite) {
    throw new Error('An invitation has already been sent to this email')
  }

  // Create invitation
  const token = generateInvitationToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

  const adminSupabase = createAdminClient()
  const { data: invitation, error } = await adminSupabase
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
    .single()

  if (error) throw error

  // Send invitation email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${token}`
  
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

  return { success: true }
}

export async function updateTeamMember(formData: FormData) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id || profile.role !== 'admin') {
    throw new Error('Only admins can update team members')
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
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id || profile.role !== 'admin') {
    throw new Error('Only admins can remove team members')
  }

  const parsed = removeTeamMemberSchema.parse({
    userId: formData.get('userId'),
  })

  // Can't remove yourself
  if (parsed.userId === user.id) {
    throw new Error('You cannot remove yourself from the organization')
  }

  // Check if this is the last admin
  const { data: adminCount } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('role', 'admin')

  if (adminCount?.count === 1) {
    const { data: targetMember } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', parsed.userId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (targetMember?.role === 'admin') {
      throw new Error('Cannot remove the last admin. Promote another member first.')
    }
  }

  // Remove member from organization
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase
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

export async function resendInvitation(invitationId: string) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role, organizations(name)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id || profile.role !== 'admin') {
    throw new Error('Only admins can resend invitations')
  }

  // Get invitation
  const { data: invitation } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!invitation) throw new Error('Invitation not found')

  // Update expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const adminSupabase = createAdminClient()
  await adminSupabase
    .from('team_invitations')
    .update({
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitationId)

  // Resend email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${invitation.token}`
  
  await resend.emails.send({
    from: 'TruthSource <team@truthsource.io>',
    to: invitation.email,
    subject: `Reminder: You're invited to join ${profile.organizations.name} on TruthSource`,
    html: `
      <h2>Invitation Reminder</h2>
      <p>This is a reminder that you've been invited to join ${profile.organizations.name} on TruthSource as a ${invitation.role}.</p>
      ${invitation.message ? `<p>Message: ${invitation.message}</p>` : ''}
      <p>Click the link below to accept the invitation:</p>
      <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a>
      <p>This invitation will expire in 7 days.</p>
    `,
  })

  return { success: true }
}

export async function cancelInvitation(invitationId: string) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id || profile.role !== 'admin') {
    throw new Error('Only admins can cancel invitations')
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