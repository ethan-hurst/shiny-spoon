// PRP-016: Data Accuracy Monitor - Notification Service
import { createAdminClient } from '@/lib/supabase/admin'
import { NotificationConfig, Alert, NotificationLog } from './types'

// Notification providers would be initialized with environment variables
interface NotificationProvider {
  send(config: NotificationConfig): Promise<NotificationResult>
}

interface NotificationResult {
  success: boolean
  deliveredAt?: Date
  providerResponse?: any
  errorMessage?: string
}

export class NotificationService {
  private supabase = createAdminClient()
  private providers: Map<string, NotificationProvider>

  constructor() {
    this.providers = new Map()
    this.initializeProviders()
  }

  private initializeProviders() {
    // Initialize email provider (Resend)
    if (process.env.RESEND_API_KEY) {
      this.providers.set('email', new EmailProvider())
    }

    // Initialize SMS provider (Twilio)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.providers.set('sms', new SMSProvider())
    }

    // In-app notifications always available
    this.providers.set('in_app', new InAppProvider(this.supabase))

    // Webhook provider
    this.providers.set('webhook', new WebhookProvider())
  }

  async send(config: NotificationConfig): Promise<boolean> {
    try {
      // Get the provider for this channel
      const provider = this.providers.get(config.channel)
      if (!provider) {
        console.error(`No provider configured for channel: ${config.channel}`)
        return false
      }

      // Get recipient information
      const recipient = await this.getRecipient(config)
      if (!recipient) {
        console.error(`No recipient found for notification`)
        return false
      }

      // Create notification log entry
      const { data: logEntry } = await this.supabase
        .from('notification_log')
        .insert({
          alert_id: config.alertId,
          channel: config.channel,
          recipient,
          status: 'pending',
        })
        .select()
        .single()

      if (!logEntry) {
        console.error('Failed to create notification log entry')
        return false
      }

      // Send the notification
      const result = await provider.send({
        ...config,
        metadata: {
          ...config.metadata,
          recipient,
          logId: logEntry.id,
        }
      })

      // Update log entry with result
      await this.supabase
        .from('notification_log')
        .update({
          status: result.success ? 'delivered' : 'failed',
          sent_at: new Date().toISOString(),
          delivered_at: result.deliveredAt?.toISOString(),
          provider_response: result.providerResponse,
          error_message: result.errorMessage,
        })
        .eq('id', logEntry.id)

      return result.success
    } catch (error) {
      console.error('Notification send error:', error)
      return false
    }
  }

  private async getRecipient(config: NotificationConfig): Promise<string | null> {
    // Get organization settings for notification recipients
    const { data: orgSettings } = await this.supabase
      .from('organization_settings')
      .select('notification_settings')
      .eq('organization_id', config.organizationId)
      .single()

    if (!orgSettings?.notification_settings) {
      // Fallback to organization owner
      const { data: owner } = await this.supabase
        .from('organization_users')
        .select('users!inner(email)')
        .eq('organization_id', config.organizationId)
        .eq('role', 'owner')
        .single()

      return owner?.users?.email || null
    }

    const settings = orgSettings.notification_settings as any
    
    switch (config.channel) {
      case 'email':
        return settings.email_recipients?.[0] || settings.default_email
      case 'sms':
        return settings.sms_recipients?.[0] || settings.default_phone
      case 'webhook':
        return settings.webhook_urls?.[0] || settings.default_webhook
      case 'in_app':
        return config.organizationId // For in-app, recipient is the org
      default:
        return null
    }
  }

  async processNotificationQueue(): Promise<void> {
    // Get pending notifications
    const { data: pendingNotifications } = await this.supabase
      .from('notification_log')
      .select(`
        *,
        alerts!inner(
          title,
          message,
          severity,
          organization_id
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (!pendingNotifications || pendingNotifications.length === 0) return

    // Process each notification
    for (const notification of pendingNotifications) {
      await this.send({
        channel: notification.channel as any,
        alertId: notification.alert_id,
        organizationId: notification.alerts.organization_id,
        title: notification.alerts.title,
        message: notification.alerts.message,
        severity: notification.alerts.severity,
        actionUrl: `/monitoring/alerts/${notification.alert_id}`,
      })
    }
  }

  async getNotificationHistory(
    alertId: string
  ): Promise<NotificationLog[]> {
    const { data } = await this.supabase
      .from('notification_log')
      .select('*')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: false })

    return data || []
  }
}

// Email Provider using Resend
class EmailProvider implements NotificationProvider {
  private resend: any
  
  constructor() {
    // Import Resend SDK dynamically to avoid issues during build
    const { Resend } = require('resend')
    this.resend = new Resend(process.env.RESEND_API_KEY)
  }

  async send(config: NotificationConfig): Promise<NotificationResult> {
    try {
      const recipient = config.metadata?.recipient
      if (!recipient) {
        return {
          success: false,
          errorMessage: 'No email recipient specified',
        }
      }

      // Send actual email using Resend SDK
      const { data, error } = await this.resend.emails.send({
        from: 'TruthSource Alerts <alerts@truthsource.io>',
        to: recipient,
        subject: config.title,
        html: this.formatEmailHtml(config),
        tags: [
          {
            name: 'alert_id',
            value: config.alertId,
          },
          {
            name: 'severity',
            value: config.severity,
          },
        ],
      })

      if (error) {
        return {
          success: false,
          errorMessage: error.message || 'Email send failed',
          providerResponse: error,
        }
      }

      return {
        success: true,
        deliveredAt: new Date(),
        providerResponse: { messageId: data?.id },
      }
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Email send failed',
      }
    }
  }

  private formatEmailHtml(config: NotificationConfig): string {
    const severityColors = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#f59e0b',
      low: '#3b82f6',
    }

    const color = severityColors[config.severity as keyof typeof severityColors] || '#6b7280'
    
    // Validate and sanitize actionUrl
    let safeActionUrl: string | null = null
    if (config.actionUrl) {
      // Ensure actionUrl starts with / and contains no dangerous characters
      const sanitizedPath = config.actionUrl
        .replace(/[<>"']/g, '') // Remove potentially dangerous characters
        .replace(/\/+/g, '/') // Normalize multiple slashes
        .trim()
      
      if (sanitizedPath.startsWith('/') && sanitizedPath.length > 1) {
        safeActionUrl = sanitizedPath
      }
    }

    // HTML encode message content to prevent XSS
    const htmlEncode = (str: string) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background-color: ${color}; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .severity { display: inline-block; padding: 4px 12px; background-color: ${color}; color: white; border-radius: 4px; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">${htmlEncode(config.title)}</h2>
          </div>
          <div class="content">
            <p><span class="severity">${config.severity.toUpperCase()}</span></p>
            <div style="white-space: pre-line; margin-top: 20px;">${htmlEncode(config.message)}</div>
            ${safeActionUrl ? `
              <a href="${process.env.NEXT_PUBLIC_APP_URL}${safeActionUrl}" class="button">
                View Alert Details
              </a>
            ` : ''}
          </div>
          <div style="margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center;">
            <p>You're receiving this because you're subscribed to TruthSource alerts.</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications" style="color: #3b82f6;">Manage notification preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}

// SMS Provider using Twilio
class SMSProvider implements NotificationProvider {
  private twilioClient: any
  
  constructor() {
    // Import Twilio SDK dynamically to avoid issues during build
    const twilio = require('twilio')
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  }

  async send(config: NotificationConfig): Promise<NotificationResult> {
    try {
      const recipient = config.metadata?.recipient
      if (!recipient) {
        return {
          success: false,
          errorMessage: 'No phone number specified',
        }
      }

      const fromNumber = process.env.TWILIO_PHONE_NUMBER
      if (!fromNumber) {
        return {
          success: false,
          errorMessage: 'Twilio phone number not configured',
        }
      }

      const message = this.formatSMSMessage(config)

      // Send actual SMS using Twilio SDK
      const result = await this.twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: recipient,
        statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
      })

      return {
        success: true,
        deliveredAt: new Date(),
        providerResponse: { 
          sid: result.sid,
          status: result.status,
          price: result.price,
          priceUnit: result.priceUnit,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error?.message || 'SMS send failed',
        providerResponse: {
          code: error?.code,
          status: error?.status,
          moreInfo: error?.moreInfo,
        },
      }
    }
  }

  private formatSMSMessage(config: NotificationConfig): string {
    // SMS has character limits, so keep it concise
    const lines = [`🚨 ${config.severity.toUpperCase()} Alert`, config.title]
    
    // Only include URL if actionUrl is valid
    if (config.actionUrl) {
      // Validate actionUrl - ensure it's a relative path starting with /
      const sanitizedPath = config.actionUrl
        .replace(/[<>"']/g, '') // Remove potentially dangerous characters
        .replace(/\/+/g, '/') // Normalize multiple slashes
        .trim()
      
      if (sanitizedPath.startsWith('/') && sanitizedPath.length > 1) {
        lines.push('', 'View details:', `${process.env.NEXT_PUBLIC_APP_URL}${sanitizedPath}`)
      }
    }

    return lines.join('\n')
  }
}

// In-App Provider
class InAppProvider implements NotificationProvider {
  constructor(private supabase: any) {}

  async send(config: NotificationConfig): Promise<NotificationResult> {
    try {
      // Create in-app notification record
      const { error } = await this.supabase
        .from('in_app_notifications')
        .insert({
          organization_id: config.organizationId,
          title: config.title,
          message: config.message,
          severity: config.severity,
          type: 'alert',
          action_url: config.actionUrl,
          metadata: {
            alert_id: config.alertId,
            ...config.metadata,
          },
          is_read: false,
        })

      if (error) {
        return {
          success: false,
          errorMessage: error.message,
        }
      }

      // Broadcast real-time event
      await this.supabase
        .channel(`org:${config.organizationId}`)
        .send({
          type: 'broadcast',
          event: 'new_notification',
          payload: {
            title: config.title,
            severity: config.severity,
            alertId: config.alertId,
          }
        })

      return {
        success: true,
        deliveredAt: new Date(),
      }
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'In-app notification failed',
      }
    }
  }
}

// Webhook Provider
class WebhookProvider implements NotificationProvider {
  async send(config: NotificationConfig): Promise<NotificationResult> {
    try {
      const webhookUrl = config.metadata?.recipient
      if (!webhookUrl) {
        return {
          success: false,
          errorMessage: 'No webhook URL specified',
        }
      }

      const payload = {
        event: 'accuracy_alert',
        alert_id: config.alertId,
        organization_id: config.organizationId,
        title: config.title,
        message: config.message,
        severity: config.severity,
        action_url: `${process.env.NEXT_PUBLIC_APP_URL}${config.actionUrl}`,
        timestamp: new Date().toISOString(),
        metadata: config.metadata,
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TruthSource/1.0',
          'X-TruthSource-Event': 'accuracy_alert',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        return {
          success: false,
          errorMessage: `Webhook returned ${response.status}: ${response.statusText}`,
          providerResponse: {
            status: response.status,
            statusText: response.statusText,
          },
        }
      }

      return {
        success: true,
        deliveredAt: new Date(),
        providerResponse: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        },
      }
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Webhook call failed',
      }
    }
  }
}