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

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const parsed = loginSchema.safeParse({ email, password })

  if (!parsed.success) {
    return {
      error: 'Invalid email or password format.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Return a generic error to avoid leaking implementation details.
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Invalid email or password.' }
    }
    console.error('Supabase sign-in error:', error.message)
    return { error: 'An unexpected error occurred during sign-in.' }
  }

  if (!data.user) {
    // This case should not be reachable if there is no error, but as a safeguard:
    console.error('Sign-in successful, but no user object returned.')
    return { error: 'Could not retrieve user details after sign-in.' }
  }

  // On success, revalidate the path and redirect the user.
  revalidatePath('/', 'layout')
  return redirect('/')
}

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

export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

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
