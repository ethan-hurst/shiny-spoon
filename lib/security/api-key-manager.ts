/**
 * API Key Management for TruthSource
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export interface APIKey {
  id: string
  name: string
  key_hash: string
  organization_id: string
  permissions: string[]
  expires_at?: Date
  last_used_at?: Date
  created_at: Date
  created_by: string
  is_active: boolean
  rate_limit: number
  ip_whitelist?: string[]
}

export interface APIKeyUsage {
  key_id: string
  endpoint: string
  method: string
  response_time: number
  status_code: number
  ip_address: string
  user_agent?: string
  timestamp: Date
}

export interface SecurityEvent {
  id: string
  type: 'api_key_created' | 'api_key_revoked' | 'api_key_rotated' | 'failed_auth' | 'rate_limit_exceeded' | 'suspicious_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  metadata: Record<string, any>
  ip_address?: string
  user_agent?: string
  organization_id: string
  timestamp: Date
}

export class APIKeyManager {
  constructor(private supabase: any) {}

  /**
   * Generate a new API key
   */
  async generateAPIKey(
    organizationId: string,
    name: string,
    permissions: string[],
    options: {
      expiresAt?: Date
      rateLimit?: number
      ipWhitelist?: string[]
      createdBy: string
    }
  ): Promise<{ key: string; apiKey: APIKey }> {
    // Generate secure API key
    const key = this.generateSecureKey()
    const keyHash = await this.hashKey(key)

    // Create API key record
    const { data: apiKey, error } = await this.supabase
      .from('api_keys')
      .insert({
        name,
        key_hash: keyHash,
        organization_id: organizationId,
        permissions,
        expires_at: options.expiresAt?.toISOString(),
        rate_limit: options.rateLimit || 1000,
        ip_whitelist: options.ipWhitelist,
        created_by: options.createdBy,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create API key: ${error.message}`)
    }

    // Log security event
    await this.logSecurityEvent({
      type: 'api_key_created',
      severity: 'medium',
      description: `API key "${name}" created`,
      metadata: { key_id: apiKey.id, permissions },
      organization_id: organizationId,
      timestamp: new Date(),
    })

    return { key, apiKey }
  }

  /**
   * Validate API key
   */
  async validateAPIKey(
    key: string,
    requiredPermissions: string[] = [],
    ipAddress?: string
  ): Promise<{ valid: boolean; apiKey?: APIKey; error?: string }> {
    try {
      const keyHash = await this.hashKey(key)

      // Get API key
      const { data: apiKey, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single()

      if (error || !apiKey) {
        await this.logSecurityEvent({
          type: 'failed_auth',
          severity: 'medium',
          description: 'Invalid API key provided',
          metadata: { provided_key: key.substring(0, 8) + '...' },
          ip_address: ipAddress,
          organization_id: 'unknown',
          timestamp: new Date(),
        })
        return { valid: false, error: 'Invalid API key' }
      }

      // Check if key is expired
      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        await this.logSecurityEvent({
          type: 'failed_auth',
          severity: 'medium',
          description: 'Expired API key used',
          metadata: { key_id: apiKey.id },
          ip_address: ipAddress,
          organization_id: apiKey.organization_id,
          timestamp: new Date(),
        })
        return { valid: false, error: 'API key expired' }
      }

      // Check IP whitelist
      if (apiKey.ip_whitelist && ipAddress) {
        const allowedIPs = Array.isArray(apiKey.ip_whitelist) 
          ? apiKey.ip_whitelist 
          : [apiKey.ip_whitelist]
        
        if (!allowedIPs.some(allowedIP => this.isIPMatch(ipAddress, allowedIP))) {
          await this.logSecurityEvent({
            type: 'failed_auth',
            severity: 'high',
            description: 'API key used from unauthorized IP',
            metadata: { key_id: apiKey.id, ip_address: ipAddress, allowed_ips: allowedIPs },
            ip_address: ipAddress,
            organization_id: apiKey.organization_id,
            timestamp: new Date(),
          })
          return { valid: false, error: 'IP address not authorized' }
        }
      }

      // Check permissions
      if (requiredPermissions.length > 0) {
        const hasPermission = requiredPermissions.every(permission =>
          apiKey.permissions.includes(permission)
        )
        
        if (!hasPermission) {
          await this.logSecurityEvent({
            type: 'failed_auth',
            severity: 'high',
            description: 'Insufficient permissions for API key',
            metadata: { key_id: apiKey.id, required_permissions: requiredPermissions, actual_permissions: apiKey.permissions },
            ip_address: ipAddress,
            organization_id: apiKey.organization_id,
            timestamp: new Date(),
          })
          return { valid: false, error: 'Insufficient permissions' }
        }
      }

      // Update last used timestamp
      await this.supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKey.id)

      return { valid: true, apiKey }
    } catch (error) {
      console.error('API key validation error:', error)
      return { valid: false, error: 'Validation error' }
    }
  }

  /**
   * Rotate API key
   */
  async rotateAPIKey(keyId: string, organizationId: string): Promise<{ newKey: string; apiKey: APIKey }> {
    // Get current API key
    const { data: currentKey, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !currentKey) {
      throw new Error('API key not found')
    }

    // Generate new key
    const newKey = this.generateSecureKey()
    const newKeyHash = await this.hashKey(newKey)

    // Update API key
    const { data: updatedKey, error: updateError } = await this.supabase
      .from('api_keys')
      .update({
        key_hash: newKeyHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', keyId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to rotate API key: ${updateError.message}`)
    }

    // Log security event
    await this.logSecurityEvent({
      type: 'api_key_rotated',
      severity: 'medium',
      description: `API key "${currentKey.name}" rotated`,
      metadata: { key_id: keyId },
      organization_id: organizationId,
      timestamp: new Date(),
    })

    return { newKey, apiKey: updatedKey }
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(keyId: string, organizationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('api_keys')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', keyId)
      .eq('organization_id', organizationId)

    if (error) {
      throw new Error(`Failed to revoke API key: ${error.message}`)
    }

    // Log security event
    await this.logSecurityEvent({
      type: 'api_key_revoked',
      severity: 'medium',
      description: `API key revoked`,
      metadata: { key_id: keyId },
      organization_id: organizationId,
      timestamp: new Date(),
    })
  }

  /**
   * List API keys for organization
   */
  async listAPIKeys(organizationId: string): Promise<APIKey[]> {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to list API keys: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get API key usage statistics
   */
  async getAPIKeyUsage(keyId: string, days: number = 30): Promise<APIKeyUsage[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await this.supabase
      .from('api_key_usage')
      .select('*')
      .eq('key_id', keyId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })

    if (error) {
      throw new Error(`Failed to get API key usage: ${error.message}`)
    }

    return data || []
  }

  /**
   * Log API key usage
   */
  async logAPIKeyUsage(usage: Omit<APIKeyUsage, 'timestamp'>): Promise<void> {
    await this.supabase
      .from('api_key_usage')
      .insert({
        ...usage,
        timestamp: new Date().toISOString(),
      })
  }

  /**
   * Get security events
   */
  async getSecurityEvents(
    organizationId: string,
    options: {
      severity?: string[]
      type?: string[]
      days?: number
      limit?: number
    } = {}
  ): Promise<SecurityEvent[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (options.days || 7))

    let query = this.supabase
      .from('security_events')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })

    if (options.severity?.length) {
      query = query.in('severity', options.severity)
    }

    if (options.type?.length) {
      query = query.in('type', options.type)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get security events: ${error.message}`)
    }

    return data || []
  }

  /**
   * Generate secure API key
   */
  private generateSecureKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = 'ts_'
    
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    return result
  }

  /**
   * Hash API key for storage
   */
  private async hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(key)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Check if IP matches pattern (supports wildcards)
   */
  private isIPMatch(ip: string, pattern: string): boolean {
    if (pattern === '*') return true
    
    const ipParts = ip.split('.')
    const patternParts = pattern.split('.')
    
    if (ipParts.length !== 4 || patternParts.length !== 4) return false
    
    return patternParts.every((part, index) => {
      if (part === '*') return true
      return ipParts[index] === part
    })
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(event: Omit<SecurityEvent, 'id'>): Promise<void> {
    try {
      await this.supabase
        .from('security_events')
        .insert({
          ...event,
          timestamp: event.timestamp.toISOString(),
        })
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }
} 