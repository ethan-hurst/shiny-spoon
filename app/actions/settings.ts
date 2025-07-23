'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
})

const updateNotificationPrefsSchema = z.object({
  emailNotifications: z.boolean(),
  billingAlerts: z.boolean(),
  usageAlerts: z.boolean(),
  teamUpdates: z.boolean(),
  apiUpdates: z.boolean(),
  productUpdates: z.boolean(),
  securityAlerts: z.boolean(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export async function updateProfile(formData: FormData) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const parsed = updateProfileSchema.parse({
    displayName: formData.get('displayName') || undefined,
    bio: formData.get('bio') || undefined,
  })

  // Update user profile
  const { error } = await supabase
    .from('user_profiles')
    .update({
      display_name: parsed.displayName,
      bio: parsed.bio,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) throw error

  return { success: true }
}

export async function updateNotificationPreferences(formData: FormData) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const parsed = updateNotificationPrefsSchema.parse({
    emailNotifications: formData.get('emailNotifications') === 'true',
    billingAlerts: formData.get('billingAlerts') === 'true',
    usageAlerts: formData.get('usageAlerts') === 'true',
    teamUpdates: formData.get('teamUpdates') === 'true',
    apiUpdates: formData.get('apiUpdates') === 'true',
    productUpdates: formData.get('productUpdates') === 'true',
    securityAlerts: formData.get('securityAlerts') === 'true',
  })

  // Upsert notification preferences
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase
    .from('notification_preferences')
    .upsert({
      user_id: user.id,
      email_notifications: parsed.emailNotifications,
      billing_alerts: parsed.billingAlerts,
      usage_alerts: parsed.usageAlerts,
      team_updates: parsed.teamUpdates,
      api_updates: parsed.apiUpdates,
      product_updates: parsed.productUpdates,
      security_alerts: parsed.securityAlerts,
      updated_at: new Date().toISOString(),
    })

  if (error) throw error

  return { success: true }
}

export async function changePassword(formData: FormData) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const parsed = changePasswordSchema.parse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })

  // Verify current password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: parsed.currentPassword,
  })

  if (signInError) {
    throw new Error('Current password is incorrect')
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.newPassword,
  })

  if (updateError) throw updateError

  return { success: true }
}

export async function enableTwoFactor() {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // In production, you would implement actual 2FA logic here
  // This is a placeholder for the implementation
  throw new Error('Two-factor authentication setup not implemented yet')
}

export async function disableTwoFactor() {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // In production, you would implement actual 2FA logic here
  // This is a placeholder for the implementation
  throw new Error('Two-factor authentication disable not implemented yet')
}

export async function downloadAccountData() {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Gather all user data
  const [profile, apiKeys, activity] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('api_keys')
      .select('name, created_at, last_used_at, permissions')
      .eq('created_by', user.id),
    supabase
      .from('api_call_logs')
      .select('endpoint, method, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const userData = {
    profile: profile.data,
    apiKeys: apiKeys.data,
    recentActivity: activity.data,
    exportedAt: new Date().toISOString(),
  }

  return {
    data: JSON.stringify(userData, null, 2),
    filename: `truthsource-data-${user.id}-${Date.now()}.json`,
  }
}