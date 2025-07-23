'use server'

import { createServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
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
  try {
    const supabase = createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Parse and validate input
    const rawData = {
      displayName: formData.get('displayName'),
      bio: formData.get('bio'),
    }

    const parsed = updateProfileSchema.parse({
      displayName: rawData.displayName ? String(rawData.displayName).trim() : undefined,
      bio: rawData.bio ? String(rawData.bio).trim() : undefined,
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0]?.message || 'Validation error')
    }
    throw error
  }
}

export async function updateNotificationPreferences(formData: FormData) {
  try {
    const supabase = createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Safely parse boolean values
    const parseBoolean = (value: FormDataEntryValue | null): boolean => {
      return value === 'true'
    }

    const parsed = updateNotificationPrefsSchema.parse({
      emailNotifications: parseBoolean(formData.get('emailNotifications')),
      billingAlerts: parseBoolean(formData.get('billingAlerts')),
      usageAlerts: parseBoolean(formData.get('usageAlerts')),
      teamUpdates: parseBoolean(formData.get('teamUpdates')),
      apiUpdates: parseBoolean(formData.get('apiUpdates')),
      productUpdates: parseBoolean(formData.get('productUpdates')),
      securityAlerts: parseBoolean(formData.get('securityAlerts')),
    })

    // Upsert notification preferences
    const { error } = await supabaseAdmin
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0]?.message || 'Validation error')
    }
    throw error
  }
}

export async function changePassword(formData: FormData) {
  try {
    const supabase = createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    if (!user.email) throw new Error('User email not found')

    // Safely get string values
    const rawData = {
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    }

    // Validate all fields are strings
    if (!rawData.currentPassword || !rawData.newPassword || !rawData.confirmPassword) {
      throw new Error('All password fields are required')
    }

    const parsed = changePasswordSchema.parse({
      currentPassword: String(rawData.currentPassword),
      newPassword: String(rawData.newPassword),
      confirmPassword: String(rawData.confirmPassword),
    })

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0]?.message || 'Validation error')
    }
    throw error
  }
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
  try {
    const supabase = createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Get user profile to verify organization
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!userProfile?.organization_id) {
      throw new Error('No organization found for user')
    }

    // Gather all user data with proper error handling
    const [profile, apiKeys, activity] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('api_keys')
        .select('name, created_at, last_used_at, permissions')
        .eq('created_by', user.id)
        .eq('organization_id', userProfile.organization_id),
      supabase
        .from('api_call_logs')
        .select('endpoint, method, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    // Check for errors in responses
    if (profile.error) throw profile.error
    if (apiKeys.error) throw apiKeys.error
    if (activity.error) throw activity.error

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
  } catch (error) {
    console.error('Failed to download account data:', error)
    throw new Error('Failed to export account data')
  }
}