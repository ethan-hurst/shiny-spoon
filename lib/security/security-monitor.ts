/**
 * Security Monitoring and Alerting for TruthSource
 */

export interface SecurityAlert {
  id: string
  type: 'failed_auth' | 'suspicious_ip' | 'rate_limit_exceeded' | 'api_key_abuse' | 'geo_violation' | 'unusual_pattern'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  metadata: Record<string, any>
  organization_id: string
  ip_address?: string
  user_agent?: string
  timestamp: Date
  acknowledged: boolean
  resolved: boolean
}

export interface SecurityMetrics {
  totalAlerts: number
  criticalAlerts: number
  failedAuthAttempts: number
  suspiciousIPs: number
  blockedRequests: number
  avgResponseTime: number
}

export interface ThreatIntelligence {
  ip_address: string
  threat_score: number
  threat_type: string[]
  first_seen: Date
  last_seen: Date
  organization_id: string
}

export class SecurityMonitor {
  constructor(private supabase: any) {}

  /**
   * Monitor security events in real-time
   */
  async monitorSecurityEvents(organizationId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = []

    try {
      // Check for failed authentication attempts
      const failedAuthAlerts = await this.checkFailedAuthAttempts(organizationId)
      alerts.push(...failedAuthAlerts)

      // Check for suspicious IP activity
      const suspiciousIPAlerts = await this.checkSuspiciousIPActivity(organizationId)
      alerts.push(...suspiciousIPAlerts)

      // Check for rate limit violations
      const rateLimitAlerts = await this.checkRateLimitViolations(organizationId)
      alerts.push(...rateLimitAlerts)

      // Check for API key abuse
      const apiKeyAlerts = await this.checkAPIKeyAbuse(organizationId)
      alerts.push(...apiKeyAlerts)

      // Check for unusual access patterns
      const patternAlerts = await this.checkUnusualPatterns(organizationId)
      alerts.push(...patternAlerts)

      // Save alerts to database
      for (const alert of alerts) {
        await this.saveSecurityAlert(alert)
      }

      return alerts
    } catch (error) {
      console.error('Security monitoring error:', error)
      return []
    }
  }

  /**
   * Check for failed authentication attempts
   */
  private async checkFailedAuthAttempts(organizationId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = []
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Get failed auth events from the last hour
    const { data: failedAuths } = await this.supabase
      .from('security_events')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('type', 'failed_auth')
      .gte('timestamp', oneHourAgo.toISOString())

    if (!failedAuths) return alerts

    // Group by IP address
    const ipCounts = new Map<string, number>()
    for (const event of failedAuths) {
      const ip = event.ip_address || 'unknown'
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1)
    }

    // Create alerts for excessive failed attempts
    for (const [ip, count] of ipCounts) {
      if (count >= 10) {
        alerts.push({
          id: `failed_auth_${ip}_${Date.now()}`,
          type: 'failed_auth',
          severity: count >= 50 ? 'critical' : count >= 20 ? 'high' : 'medium',
          title: `Excessive Failed Authentication Attempts`,
          description: `${count} failed authentication attempts from IP ${ip} in the last hour`,
          metadata: { ip_address: ip, attempt_count: count, time_window: '1 hour' },
          organization_id: organizationId,
          ip_address: ip,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        })
      }
    }

    return alerts
  }

  /**
   * Check for suspicious IP activity
   */
  private async checkSuspiciousIPActivity(organizationId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = []
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get access logs from the last day
    const { data: accessLogs } = await this.supabase
      .from('access_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('timestamp', oneDayAgo.toISOString())

    if (!accessLogs) return alerts

    // Analyze IP activity patterns
    const ipStats = new Map<string, { requests: number; errors: number; uniqueEndpoints: Set<string> }>()

    for (const log of accessLogs) {
      const ip = log.ip_address
      if (!ipStats.has(ip)) {
        ipStats.set(ip, { requests: 0, errors: 0, uniqueEndpoints: new Set() })
      }

      const stats = ipStats.get(ip)!
      stats.requests++
      stats.uniqueEndpoints.add(log.endpoint)

      if (log.status_code >= 400) {
        stats.errors++
      }
    }

    // Create alerts for suspicious patterns
    for (const [ip, stats] of ipStats) {
      const errorRate = (stats.errors / stats.requests) * 100
      const endpointDiversity = stats.uniqueEndpoints.size

      if (stats.requests > 1000) {
        alerts.push({
          id: `suspicious_ip_${ip}_${Date.now()}`,
          type: 'suspicious_ip',
          severity: 'high',
          title: `High Request Volume from IP`,
          description: `IP ${ip} made ${stats.requests} requests in 24 hours`,
          metadata: { ip_address: ip, request_count: stats.requests, error_rate: errorRate },
          organization_id: organizationId,
          ip_address: ip,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        })
      }

      if (errorRate > 50) {
        alerts.push({
          id: `high_error_rate_${ip}_${Date.now()}`,
          type: 'suspicious_ip',
          severity: 'medium',
          title: `High Error Rate from IP`,
          description: `IP ${ip} has ${errorRate.toFixed(1)}% error rate`,
          metadata: { ip_address: ip, error_rate: errorRate, request_count: stats.requests },
          organization_id: organizationId,
          ip_address: ip,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        })
      }
    }

    return alerts
  }

  /**
   * Check for rate limit violations
   */
  private async checkRateLimitViolations(organizationId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = []
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Get rate limit events
    const { data: rateLimitEvents } = await this.supabase
      .from('security_events')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('type', 'rate_limit_exceeded')
      .gte('timestamp', oneHourAgo.toISOString())

    if (!rateLimitEvents) return alerts

    // Group by IP address
    const ipCounts = new Map<string, number>()
    for (const event of rateLimitEvents) {
      const ip = event.ip_address || 'unknown'
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1)
    }

    // Create alerts for repeated rate limit violations
    for (const [ip, count] of ipCounts) {
      if (count >= 5) {
        alerts.push({
          id: `rate_limit_${ip}_${Date.now()}`,
          type: 'rate_limit_exceeded',
          severity: 'medium',
          title: `Repeated Rate Limit Violations`,
          description: `IP ${ip} exceeded rate limits ${count} times in the last hour`,
          metadata: { ip_address: ip, violation_count: count, time_window: '1 hour' },
          organization_id: organizationId,
          ip_address: ip,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        })
      }
    }

    return alerts
  }

  /**
   * Check for API key abuse
   */
  private async checkAPIKeyAbuse(organizationId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = []
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get API key usage
    const { data: apiKeyUsage } = await this.supabase
      .from('api_key_usage')
      .select('*')
      .gte('timestamp', oneDayAgo.toISOString())

    if (!apiKeyUsage) return alerts

    // Group by API key
    const keyStats = new Map<string, { requests: number; errors: number; uniqueIPs: Set<string> }>()

    for (const usage of apiKeyUsage) {
      if (!keyStats.has(usage.key_id)) {
        keyStats.set(usage.key_id, { requests: 0, errors: 0, uniqueIPs: new Set() })
      }

      const stats = keyStats.get(usage.key_id)!
      stats.requests++
      stats.uniqueIPs.add(usage.ip_address)

      if (usage.status_code >= 400) {
        stats.errors++
      }
    }

    // Create alerts for suspicious API key usage
    for (const [keyId, stats] of keyStats) {
      const errorRate = (stats.errors / stats.requests) * 100

      if (stats.requests > 10000) {
        alerts.push({
          id: `api_key_abuse_${keyId}_${Date.now()}`,
          type: 'api_key_abuse',
          severity: 'high',
          title: `High API Key Usage`,
          description: `API key ${keyId} made ${stats.requests} requests in 24 hours`,
          metadata: { key_id: keyId, request_count: stats.requests, unique_ips: stats.uniqueIPs.size },
          organization_id: organizationId,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        })
      }

      if (stats.uniqueIPs.size > 10) {
        alerts.push({
          id: `api_key_multiple_ips_${keyId}_${Date.now()}`,
          type: 'api_key_abuse',
          severity: 'medium',
          title: `API Key Used from Multiple IPs`,
          description: `API key ${keyId} used from ${stats.uniqueIPs.size} different IP addresses`,
          metadata: { key_id: keyId, unique_ips: stats.uniqueIPs.size, ip_list: Array.from(stats.uniqueIPs) },
          organization_id: organizationId,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        })
      }
    }

    return alerts
  }

  /**
   * Check for unusual access patterns
   */
  private async checkUnusualPatterns(organizationId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = []
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get access logs
    const { data: accessLogs } = await this.supabase
      .from('access_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('timestamp', oneDayAgo.toISOString())

    if (!accessLogs) return alerts

    // Analyze patterns
    const hourlyPatterns = new Map<number, number>()
    const endpointPatterns = new Map<string, number>()

    for (const log of accessLogs) {
      const hour = new Date(log.timestamp).getHours()
      hourlyPatterns.set(hour, (hourlyPatterns.get(hour) || 0) + 1)
      endpointPatterns.set(log.endpoint, (endpointPatterns.get(log.endpoint) || 0) + 1)
    }

    // Check for unusual time patterns (e.g., activity at 3 AM)
    for (const [hour, count] of hourlyPatterns) {
      if (hour >= 22 || hour <= 6) {
        if (count > 100) {
          alerts.push({
            id: `unusual_time_${hour}_${Date.now()}`,
            type: 'unusual_pattern',
            severity: 'medium',
            title: `Unusual Activity During Off-Hours`,
            description: `${count} requests during hour ${hour}:00`,
            metadata: { hour, request_count: count, time_period: 'off-hours' },
            organization_id: organizationId,
            timestamp: new Date(),
            acknowledged: false,
            resolved: false,
          })
        }
      }
    }

    // Check for unusual endpoint access
    for (const [endpoint, count] of endpointPatterns) {
      if (count > 1000) {
        alerts.push({
          id: `unusual_endpoint_${endpoint}_${Date.now()}`,
          type: 'unusual_pattern',
          severity: 'medium',
          title: `High Endpoint Usage`,
          description: `${endpoint} accessed ${count} times in 24 hours`,
          metadata: { endpoint, request_count: count },
          organization_id: organizationId,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        })
      }
    }

    return alerts
  }

  /**
   * Save security alert to database
   */
  private async saveSecurityAlert(alert: SecurityAlert): Promise<void> {
    try {
      await this.supabase
        .from('security_alerts')
        .insert({
          ...alert,
          timestamp: alert.timestamp.toISOString(),
        })
    } catch (error) {
      console.error('Failed to save security alert:', error)
    }
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(organizationId: string): Promise<SecurityMetrics> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get alerts
    const { data: alerts } = await this.supabase
      .from('security_alerts')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('timestamp', oneDayAgo.toISOString())

    // Get access logs
    const { data: accessLogs } = await this.supabase
      .from('access_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('timestamp', oneDayAgo.toISOString())

    const totalAlerts = alerts?.length || 0
    const criticalAlerts = alerts?.filter(a => a.severity === 'critical').length || 0
    const failedAuthAttempts = accessLogs?.filter(l => l.status_code === 401 || l.status_code === 403).length || 0
    const suspiciousIPs = new Set(accessLogs?.map(l => l.ip_address).filter(Boolean)).size
    const blockedRequests = accessLogs?.filter(l => l.blocked).length || 0
    const avgResponseTime = accessLogs?.length 
      ? accessLogs.reduce((sum, l) => sum + l.response_time, 0) / accessLogs.length 
      : 0

    return {
      totalAlerts,
      criticalAlerts,
      failedAuthAttempts,
      suspiciousIPs,
      blockedRequests,
      avgResponseTime,
    }
  }

  /**
   * Get active security alerts
   */
  async getActiveAlerts(organizationId: string): Promise<SecurityAlert[]> {
    const { data, error } = await this.supabase
      .from('security_alerts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('resolved', false)
      .order('timestamp', { ascending: false })

    if (error) {
      throw new Error(`Failed to get active alerts: ${error.message}`)
    }

    return data || []
  }

  /**
   * Acknowledge security alert
   */
  async acknowledgeAlert(alertId: string, organizationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('security_alerts')
      .update({ acknowledged: true })
      .eq('id', alertId)
      .eq('organization_id', organizationId)

    if (error) {
      throw new Error(`Failed to acknowledge alert: ${error.message}`)
    }
  }

  /**
   * Resolve security alert
   */
  async resolveAlert(alertId: string, organizationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('security_alerts')
      .update({ resolved: true })
      .eq('id', alertId)
      .eq('organization_id', organizationId)

    if (error) {
      throw new Error(`Failed to resolve alert: ${error.message}`)
    }
  }
} 