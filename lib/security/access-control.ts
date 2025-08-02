/**
 * Access Control and IP Whitelisting for TruthSource
 */

export interface IPRule {
  id: string
  organization_id: string
  ip_address: string
  description: string
  is_active: boolean
  created_at: Date
  created_by: string
  expires_at?: Date
}

export interface AccessLog {
  id: string
  organization_id: string
  ip_address: string
  user_agent?: string
  endpoint: string
  method: string
  status_code: number
  response_time: number
  timestamp: Date
  blocked: boolean
  reason?: string
}

export interface SecurityPolicy {
  id: string
  organization_id: string
  name: string
  type: 'ip_whitelist' | 'rate_limit' | 'geo_block' | 'user_agent_block'
  rules: Record<string, any>
  is_active: boolean
  priority: number
  created_at: Date
  updated_at: Date
}

export class AccessControl {
  constructor(private supabase: any) {}

  /**
   * Check if IP is allowed
   */
  async isIPAllowed(ipAddress: string, organizationId: string): Promise<{
    allowed: boolean
    reason?: string
    rule?: IPRule
  }> {
    try {
      // Get active IP rules for organization
      const { data: rules, error } = await this.supabase
        .from('ip_rules')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .is('expires_at', null)
        .or(`expires_at.gt.${new Date().toISOString()}`)

      if (error) {
        console.error('Failed to get IP rules:', error)
        return { allowed: true } // Default to allow if error
      }

      // Check if IP matches any rule
      for (const rule of rules || []) {
        if (this.isIPMatch(ipAddress, rule.ip_address)) {
          return { allowed: true, rule }
        }
      }

      // Check global IP blacklist
      const isBlacklisted = await this.isIPBlacklisted(ipAddress)
      if (isBlacklisted) {
        return { allowed: false, reason: 'IP address is blacklisted' }
      }

      // Check geo-blocking
      const geoBlocked = await this.checkGeoBlocking(ipAddress, organizationId)
      if (geoBlocked) {
        return { allowed: false, reason: 'Geographic location not allowed' }
      }

      return { allowed: true }
    } catch (error) {
      console.error('IP access check error:', error)
      return { allowed: true } // Default to allow on error
    }
  }

  /**
   * Add IP to whitelist
   */
  async addIPToWhitelist(
    organizationId: string,
    ipAddress: string,
    description: string,
    createdBy: string,
    expiresAt?: Date
  ): Promise<IPRule> {
    // Validate IP address format
    if (!this.isValidIP(ipAddress)) {
      throw new Error('Invalid IP address format')
    }

    const { data: rule, error } = await this.supabase
      .from('ip_rules')
      .insert({
        organization_id: organizationId,
        ip_address: ipAddress,
        description,
        is_active: true,
        created_by: createdBy,
        expires_at: expiresAt?.toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add IP to whitelist: ${error.message}`)
    }

    return rule
  }

  /**
   * Remove IP from whitelist
   */
  async removeIPFromWhitelist(ruleId: string, organizationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ip_rules')
      .update({ is_active: false })
      .eq('id', ruleId)
      .eq('organization_id', organizationId)

    if (error) {
      throw new Error(`Failed to remove IP from whitelist: ${error.message}`)
    }
  }

  /**
   * Get IP whitelist for organization
   */
  async getIPWhitelist(organizationId: string): Promise<IPRule[]> {
    const { data, error } = await this.supabase
      .from('ip_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get IP whitelist: ${error.message}`)
    }

    return data || []
  }

  /**
   * Log access attempt
   */
  async logAccess(access: Omit<AccessLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      await this.supabase
        .from('access_logs')
        .insert({
          ...access,
          timestamp: new Date().toISOString(),
        })
    } catch (error) {
      console.error('Failed to log access:', error)
    }
  }

  /**
   * Get access logs for organization
   */
  async getAccessLogs(
    organizationId: string,
    options: {
      days?: number
      blocked?: boolean
      limit?: number
    } = {}
  ): Promise<AccessLog[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (options.days || 7))

    let query = this.supabase
      .from('access_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })

    if (options.blocked !== undefined) {
      query = query.eq('blocked', options.blocked)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get access logs: ${error.message}`)
    }

    return data || []
  }

  /**
   * Create security policy
   */
  async createSecurityPolicy(
    organizationId: string,
    policy: Omit<SecurityPolicy, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
  ): Promise<SecurityPolicy> {
    const { data, error } = await this.supabase
      .from('security_policies')
      .insert({
        ...policy,
        organization_id: organizationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create security policy: ${error.message}`)
    }

    return data
  }

  /**
   * Get security policies for organization
   */
  async getSecurityPolicies(organizationId: string): Promise<SecurityPolicy[]> {
    const { data, error } = await this.supabase
      .from('security_policies')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error) {
      throw new Error(`Failed to get security policies: ${error.message}`)
    }

    return data || []
  }

  /**
   * Check if IP is blacklisted globally
   */
  private async isIPBlacklisted(ipAddress: string): Promise<boolean> {
    // This would typically check against a global blacklist
    // For now, we'll implement a simple check
    const blacklistedIPs = [
      '0.0.0.0',
      '127.0.0.1',
      // Add more blacklisted IPs as needed
    ]

    return blacklistedIPs.includes(ipAddress)
  }

  /**
   * Check geo-blocking rules
   */
  private async checkGeoBlocking(ipAddress: string, organizationId: string): Promise<boolean> {
    try {
      // Get organization's geo-blocking policies
      const { data: policies } = await this.supabase
        .from('security_policies')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('type', 'geo_block')
        .eq('is_active', true)

      if (!policies || policies.length === 0) {
        return false // No geo-blocking policies
      }

      // In a real implementation, you would:
      // 1. Use a geo-IP service to get country/region from IP
      // 2. Check against the organization's geo-blocking rules
      // For now, we'll return false (no blocking)
      return false
    } catch (error) {
      console.error('Geo-blocking check error:', error)
      return false
    }
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
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipRegex.test(ip)
  }

  /**
   * Get suspicious activity patterns
   */
  async detectSuspiciousActivity(organizationId: string): Promise<{
    suspiciousIPs: string[]
    unusualPatterns: any[]
    recommendations: string[]
  }> {
    const accessLogs = await this.getAccessLogs(organizationId, { days: 1 })

    // Analyze access patterns
    const ipCounts = new Map<string, number>()
    const failedAttempts = new Map<string, number>()

    for (const log of accessLogs) {
      // Count requests per IP
      ipCounts.set(log.ip_address, (ipCounts.get(log.ip_address) || 0) + 1)

      // Count failed attempts
      if (log.status_code >= 400) {
        failedAttempts.set(log.ip_address, (failedAttempts.get(log.ip_address) || 0) + 1)
      }
    }

    const suspiciousIPs: string[] = []
    const recommendations: string[] = []

    // Detect suspicious patterns
    for (const [ip, count] of ipCounts) {
      if (count > 1000) { // More than 1000 requests in 24 hours
        suspiciousIPs.push(ip)
        recommendations.push(`High request volume from ${ip}`)
      }

      const failedCount = failedAttempts.get(ip) || 0
      if (failedCount > 100) { // More than 100 failed attempts
        suspiciousIPs.push(ip)
        recommendations.push(`High failure rate from ${ip}`)
      }
    }

    return {
      suspiciousIPs: [...new Set(suspiciousIPs)],
      unusualPatterns: [],
      recommendations,
    }
  }
} 