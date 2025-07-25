'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updatePasswordSchema,
} from '@/types/auth.types'

/**
 * Authenticates a user with email and password, verifies profile completion, and redirects to the dashboard on success.
 *
 * Validates the provided credentials, attempts sign-in, and checks for an associated user profile. If the profile is missing or an error occurs, the user is signed out and an error is returned. On successful authentication and profile verification, the root layout is revalidated and the user is redirected to the dashboard.
 *
 * @param formData - The form data containing user credentials.
 * @returns An object with an error message and field errors if authentication or validation fails; otherwise, redirects to the dashboard.
 */
export async function signIn(formData: FormData) {
  // Parse and validate input
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  // Attempt to sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: error.message }
  }

  // Check if user has a profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', data.user.id)
    .single()

  if (profileError || !profile) {
    // Sign out if no profile exists
    await supabase.auth.signOut()
    return { error: 'Account setup incomplete. Please contact support.' }
  }

  // Success - revalidate and redirect
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Handles user registration by validating input and creating a new account with Supabase.
 *
 * Validates the provided form data for email, password, confirmation, full name, and organization name. Attempts to register the user with Supabase, including user metadata. Returns error details on validation or registration failure. If email confirmation is required, returns a message prompting the user to check their email. If the user is auto-confirmed, redirects to the dashboard. Otherwise, returns a generic success message.
 *
 * @param formData - The form data containing registration fields
 * @returns An object indicating success or error, with additional information such as field errors or confirmation requirements
 */
export async function signUp(formData: FormData) {
  // Parse and validate all fields
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    fullName: formData.get('fullName'),
    organizationName: formData.get('organizationName'),
  })

  if (!parsed.success) {
    return {
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  // Sign up with metadata for trigger function
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        organization_name: parsed.data.organizationName,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (authError) {
    return { error: authError.message }
  }

  // Check if email needs confirmation
  if (authData.user && !authData.user.confirmed_at) {
    return {
      success: true,
      message: 'Check your email to confirm your account',
      requiresEmailConfirmation: true,
    }
  }

  // If auto-confirmed (dev mode), redirect to dashboard
  if (authData.user?.confirmed_at) {
    revalidatePath('/', 'layout')
    redirect('/dashboard')
  }

  return {
    success: true,
    message: 'Account created successfully',
  }
}

/**
 * Signs out the current user and redirects to the home page.
 *
 * If sign-out fails, returns an error message.
 */
export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Initiates a password reset process by sending a reset link to the provided email address.
 *
 * Validates the email from the form data and, if valid, requests a password reset email with a redirect URL. Returns error details on failure or a success message if the email was sent.
 */
export async function resetPassword(formData: FormData) {
  // Validate email
  const parsed = resetPasswordSchema.safeParse({
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return {
      error: 'Invalid email address',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/update-password`,
    }
  )

  if (error) {
    return { error: error.message }
  }

  return {
    success: true,
    message: 'Check your email for a password reset link',
  }
}

/**
 * Updates the current user's password after validating the provided input.
 *
 * If the input is invalid, returns field-specific error messages. On successful password update, revalidates the root layout and redirects the user to the dashboard.
 */
export async function updatePassword(formData: FormData) {
  // Parse and validate input
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return {
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
