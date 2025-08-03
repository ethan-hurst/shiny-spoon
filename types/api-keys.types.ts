/**
 * Type definitions for API Keys functionality
 */

export type ApiKeyPermission = 'read' | 'write' | 'delete'

export interface ApiKey {
  id: string
  organization_id: string
  name: string
  description?: string | null
  key_hash: string
  key_prefix: string
  permissions: ApiKeyPermission[]
  expires_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
  is_active: boolean
  last_used_at?: string | null
  revoked_at?: string | null
  revoked_by?: string | null
  regenerated_from?: string | null
}

export interface CreateApiKeyInput {
  name: string
  description?: string
  permissions: ApiKeyPermission[]
  expiresAt?: string
}

export interface UpdateApiKeyInput {
  id: string
  name?: string
  description?: string
  permissions?: ApiKeyPermission[]
  isActive?: boolean
}

export interface ApiKeyResponse {
  id: string
  key: string
  message: string
}

export interface CustomerBilling {
  id: string
  organization_id: string
  subscription_plan: string
  status: string
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  user_id: string
  organization_id: string
  full_name?: string | null
  role: 'owner' | 'admin' | 'member'
  permissions: Record<string, unknown>
  created_at: string
  updated_at: string
}
