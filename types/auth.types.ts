// Authentication types and validation schemas

import { z } from 'zod'
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

// Auth change handler type
export type AuthChangeHandler = (
  event: AuthChangeEvent,
  session: Session | null
) => void | Promise<void>

// User types
export interface AuthUser {
  id: string
  email: string
  user_metadata: {
    full_name?: string
    organization_name?: string
  }
}

// User permissions structure
export interface UserPermissions {
  inventory: {
    read: boolean
    write: boolean
    delete: boolean
  }
  products: {
    read: boolean
    write: boolean
    delete: boolean
  }
  warehouses: {
    read: boolean
    write: boolean
    delete: boolean
  }
  users: {
    read: boolean
    write: boolean
    delete: boolean
  }
  settings: {
    read: boolean
    write: boolean
  }
}

export interface UserProfile {
  id: string
  user_id: string
  organization_id: string
  full_name: string | null
  role: 'owner' | 'admin' | 'member'
  permissions: UserPermissions
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  subscription_tier: 'starter' | 'professional' | 'enterprise'
  subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled'
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

// Form validation schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const signupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    organizationName: z.string().min(2, 'Organization name is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type SignupFormData = z.infer<typeof signupSchema>

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>

// Auth state types
export interface AuthState {
  user: AuthUser | null
  profile: UserProfile | null
  organization: Organization | null
  isLoading: boolean
  error: string | null
}

// Auth context types
export interface AuthContextType extends AuthState {
  signIn: (data: LoginFormData) => Promise<void>
  signUp: (data: SignupFormData) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (data: ResetPasswordFormData) => Promise<void>
}
