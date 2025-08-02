import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SecurityMonitor } from '@/lib/security/security-monitor'
import { APIKeyManager } from '@/lib/security/api-key-manager'
import { AccessControl } from '@/lib/security/access-control'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check if this is a valid cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const securityMonitor = new SecurityMonitor(supabase)
    const apiKeyManager = new APIKeyManager(supabase)
    const accessControl = new AccessControl(supabase)

    // Get all organizations
    const { data: organizations } = await supabase
      .from('organizations')
      .select('id')

    if (!organizations) {
      return NextResponse.json({ message: 'No organizations found' })
    }

    let totalAlerts = 0
    let criticalAlerts = 0
    let processedOrganizations = 0

    // Monitor security for each organization
    for (const org of organizations) {
      try {
        // Run security monitoring
        const alerts = await securityMonitor.monitorSecurityEvents(org.id)
        totalAlerts += alerts.length
        criticalAlerts += alerts.filter(a => a.severity === 'critical').length

        // Check for suspicious activity
        const suspiciousActivity = await accessControl.detectSuspiciousActivity(org.id)
        
        if (suspiciousActivity.suspiciousIPs.length > 0) {
          console.log(`Suspicious activity detected for org ${org.id}:`, suspiciousActivity)
        }

        // Get security metrics
        const metrics = await securityMonitor.getSecurityMetrics(org.id)
        
        // Log high-severity events
        if (metrics.criticalAlerts > 0 || metrics.failedAuthAttempts > 50) {
          console.warn(`High security activity for org ${org.id}:`, metrics)
        }

        processedOrganizations++
      } catch (error) {
        console.error(`Error monitoring security for org ${org.id}:`, error)
      }
    }

    // Log summary
    console.log(`Security monitoring completed: ${processedOrganizations} orgs, ${totalAlerts} alerts, ${criticalAlerts} critical`)

    return NextResponse.json({
      success: true,
      processedOrganizations,
      totalAlerts,
      criticalAlerts,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Security monitoring cron error:', error)
    return NextResponse.json(
      { error: 'Security monitoring failed' },
      { status: 500 }
    )
  }
} 