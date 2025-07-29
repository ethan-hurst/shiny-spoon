import { NotificationService } from '@/lib/monitoring/notification-service'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NotificationConfig } from '@/lib/monitoring/types'

// Mock dependencies
jest.mock('@/lib/supabase/admin')
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn()
    }
  }))
}))
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn()
    }
  }))
})

// Mock crypto.subtle for webhook signatures
global.crypto = {
  subtle: {
    importKey: jest.fn(),
    sign: jest.fn()
  }
} as any

// Mock fetch
global.fetch = jest.fn()

describe('NotificationService', () => {
  let notificationService: NotificationService
  let mockSupabase: ReturnType<typeof createMockSupabase>
  
  const mockNotificationConfig: NotificationConfig = {
    channel: 'email',
    alertId: 'alert-123',
    organizationId: 'org-123',
    title: 'Critical Data Accuracy Alert',
    message: 'Accuracy dropped below 90% threshold',
    severity: 'critical',
    actionUrl: '/monitoring/alerts/alert-123',
    metadata: {
      recipient: 'test@example.com'
    }
  }

  const mockOrgSettings = {
    notification_settings: {
      email_recipients: ['admin@example.com', 'alerts@example.com'],
      sms_recipients: ['+1234567890'],
      webhook_urls: ['https://webhook.example.com/alerts'],
      default_email: 'default@example.com',
      default_phone: '+0987654321',
      default_webhook: 'https://default.example.com/webhook'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variables
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.TWILIO_ACCOUNT_SID = 'test-twilio-sid'
    process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token'
    process.env.TWILIO_PHONE_NUMBER = '+1234567890'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.truthsource.io'
    process.env.NODE_ENV = 'test'
    
    mockSupabase = createMockSupabase()
    ;(createAdminClient as jest.Mock).mockReturnValue(mockSupabase)
    
    notificationService = new NotificationService()
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_PHONE_NUMBER
  })

  describe('send', () => {
    it('should send email notification successfully', async () => {
      const mockLogEntry = { id: 'log-123' }
      const { Resend } = require('resend')
      const mockResendInstance = new Resend()
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockLogEntry,
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        if (table === 'organization_settings') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockOrgSettings,
                  error: null
                })
              })
            })
          } as any
        }
        return {} as any
      })

      mockResendInstance.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      const result = await notificationService.send(mockNotificationConfig)

      expect(result).toBe(true)
      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'TruthSource Alerts <alerts@truthsource.io>',
        to: 'test@example.com',
        subject: 'Critical Data Accuracy Alert',
        html: expect.stringContaining('Critical Data Accuracy Alert'),
        tags: [
          { name: 'alert_id', value: 'alert-123' },
          { name: 'severity', value: 'critical' }
        ]
      })
    })

    it('should send SMS notification successfully', async () => {
      const mockLogEntry = { id: 'log-123' }
      const twilio = require('twilio')
      const mockTwilioInstance = twilio()
      
      const smsConfig = {
        ...mockNotificationConfig,
        channel: 'sms' as const,
        metadata: { recipient: '+1234567890' }
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockLogEntry,
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        return {} as any
      })

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'sms-123',
        status: 'sent',
        price: '0.01',
        priceUnit: 'USD'
      })

      const result = await notificationService.send(smsConfig)

      expect(result).toBe(true)
      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        body: expect.stringContaining('🚨 CRITICAL Alert'),
        from: '+1234567890',
        to: '+1234567890',
        statusCallback: undefined
      })
    })

    it('should send in-app notification successfully', async () => {
      const mockLogEntry = { id: 'log-123' }
      const inAppConfig = {
        ...mockNotificationConfig,
        channel: 'in_app' as const
      }

      const mockChannel = {
        send: jest.fn().mockResolvedValue({ data: null, error: null })
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockLogEntry,
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        if (table === 'in_app_notifications') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          } as any
        }
        return {} as any
      })

      mockSupabase.channel = jest.fn().mockReturnValue(mockChannel)

      const result = await notificationService.send(inAppConfig)

      expect(result).toBe(true)
      expect(mockSupabase.channel).toHaveBeenCalledWith('org:org-123')
      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'new_notification',
        payload: {
          title: 'Critical Data Accuracy Alert',
          severity: 'critical',
          alertId: 'alert-123'
        }
      })
    })

    it('should send webhook notification successfully', async () => {
      const mockLogEntry = { id: 'log-123' }
      const webhookConfig = {
        ...mockNotificationConfig,
        channel: 'webhook' as const,
        metadata: {
          recipient: 'https://webhook.example.com/alerts',
          webhook_secret: 'secret-key'
        }
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockLogEntry,
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        return {} as any
      })

      ;(global.crypto.subtle.importKey as jest.Mock).mockResolvedValue('mock-key')
      ;(global.crypto.subtle.sign as jest.Mock).mockResolvedValue(new ArrayBuffer(32))
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['x-request-id', '123']])
      })

      const result = await notificationService.send(webhookConfig)

      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/alerts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-TruthSource-Event': 'accuracy_alert',
            'X-TruthSource-Signature': expect.stringMatching(/^sha256=/)
          }),
          body: expect.stringContaining('accuracy_alert')
        })
      )
    })

    it('should handle missing provider', async () => {
      const invalidConfig = {
        ...mockNotificationConfig,
        channel: 'carrier_pigeon' as any
      }

      const result = await notificationService.send(invalidConfig)

      expect(result).toBe(false)
    })

    it('should handle missing recipient', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organization_settings') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'organization_users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                  })
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const result = await notificationService.send(mockNotificationConfig)

      expect(result).toBe(false)
    })

    it('should handle notification log creation failure', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Insert failed' }
                })
              })
            })
          } as any
        }
        if (table === 'organization_settings') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockOrgSettings,
                  error: null
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const result = await notificationService.send(mockNotificationConfig)

      expect(result).toBe(false)
    })

    it('should handle exceptions gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const result = await notificationService.send(mockNotificationConfig)

      expect(result).toBe(false)
    })
  })

  describe('getRecipient', () => {
    it('should get email recipient from organization settings', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockOrgSettings,
              error: null
            })
          })
        })
      } as any)

      const recipient = await (notificationService as any).getRecipient({
        ...mockNotificationConfig,
        channel: 'email'
      })

      expect(recipient).toBe('admin@example.com')
    })

    it('should fallback to default email', async () => {
      const settingsWithoutRecipients = {
        notification_settings: {
          default_email: 'default@example.com'
        }
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: settingsWithoutRecipients,
              error: null
            })
          })
        })
      } as any)

      const recipient = await (notificationService as any).getRecipient({
        ...mockNotificationConfig,
        channel: 'email'
      })

      expect(recipient).toBe('default@example.com')
    })

    it('should fallback to organization owner email', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organization_settings') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'organization_users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { users: { email: 'owner@example.com' } },
                    error: null
                  })
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const recipient = await (notificationService as any).getRecipient({
        ...mockNotificationConfig,
        channel: 'email'
      })

      expect(recipient).toBe('owner@example.com')
    })

    it('should return organization ID for in-app channel', async () => {
      const recipient = await (notificationService as any).getRecipient({
        ...mockNotificationConfig,
        channel: 'in_app'
      })

      expect(recipient).toBe('org-123')
    })
  })

  describe('processNotificationQueue', () => {
    it('should process pending notifications', async () => {
      const pendingNotifications = [
        {
          id: 'notif-1',
          alert_id: 'alert-1',
          channel: 'email',
          status: 'pending',
          alerts: {
            title: 'Alert 1',
            message: 'Message 1',
            severity: 'high',
            organization_id: 'org-1'
          }
        },
        {
          id: 'notif-2',
          alert_id: 'alert-2',
          channel: 'sms',
          status: 'pending',
          alerts: {
            title: 'Alert 2',
            message: 'Message 2',
            severity: 'critical',
            organization_id: 'org-2'
          }
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_log') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: pendingNotifications,
                    error: null
                  })
                })
              })
            })
          } as any
        }
        return {} as any
      })

      jest.spyOn(notificationService, 'send').mockResolvedValue(true)

      await notificationService.processNotificationQueue()

      expect(notificationService.send).toHaveBeenCalledTimes(2)
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'email',
          alertId: 'alert-1',
          organizationId: 'org-1'
        })
      )
    })

    it('should handle empty queue', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      } as any)

      jest.spyOn(notificationService, 'send')

      await notificationService.processNotificationQueue()

      expect(notificationService.send).not.toHaveBeenCalled()
    })
  })

  describe('getNotificationHistory', () => {
    it('should retrieve notification history for an alert', async () => {
      const mockHistory = [
        { id: 'log-1', alert_id: 'alert-123', channel: 'email', status: 'delivered' },
        { id: 'log-2', alert_id: 'alert-123', channel: 'sms', status: 'failed' }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockHistory,
              error: null
            })
          })
        })
      } as any)

      const history = await notificationService.getNotificationHistory('alert-123')

      expect(history).toHaveLength(2)
      expect(history[0].channel).toBe('email')
      expect(history[1].status).toBe('failed')
    })

    it('should return empty array on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Query failed' }
            })
          })
        })
      } as any)

      const history = await notificationService.getNotificationHistory('alert-123')

      expect(history).toEqual([])
    })
  })

  describe('Email formatting', () => {
    it('should properly escape HTML in email content', async () => {
      const { Resend } = require('resend')
      const mockResendInstance = new Resend()
      
      const configWithHtml = {
        ...mockNotificationConfig,
        title: 'Alert <script>alert("xss")</script>',
        message: 'Message with <b>HTML</b> & entities'
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'log-123' },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        return {} as any
      })

      mockResendInstance.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      await notificationService.send(configWithHtml)

      const emailCall = mockResendInstance.emails.send.mock.calls[0][0]
      expect(emailCall.html).not.toContain('<script>')
      expect(emailCall.html).toContain('&lt;script&gt;')
      expect(emailCall.html).toContain('&lt;b&gt;HTML&lt;/b&gt; &amp; entities')
    })

    it('should validate and sanitize action URL', async () => {
      const { Resend } = require('resend')
      const mockResendInstance = new Resend()
      
      const testCases = [
        { actionUrl: '/valid/path', shouldInclude: true },
        { actionUrl: '//double/slash', shouldInclude: true, normalized: '/double/slash' },
        { actionUrl: '/path<script>', shouldInclude: true, sanitized: '/pathscript' },
        { actionUrl: '', shouldInclude: false },
        { actionUrl: '/', shouldInclude: false },
        { actionUrl: 'http://evil.com', shouldInclude: false }
      ]

      for (const testCase of testCases) {
        mockResendInstance.emails.send.mockClear()
        mockResendInstance.emails.send.mockResolvedValue({
          data: { id: 'email-123' },
          error: null
        })

        await notificationService.send({
          ...mockNotificationConfig,
          actionUrl: testCase.actionUrl
        })

        const emailHtml = mockResendInstance.emails.send.mock.calls[0]?.[0]?.html || ''
        
        if (testCase.shouldInclude) {
          expect(emailHtml).toContain('View Alert Details')
          if (testCase.normalized) {
            expect(emailHtml).toContain(`href="https://app.truthsource.io${testCase.normalized}"`)
          }
        } else {
          expect(emailHtml).not.toContain('View Alert Details')
        }
      }
    })
  })

  describe('SMS formatting', () => {
    it('should format SMS message correctly', async () => {
      const twilio = require('twilio')
      const mockTwilioInstance = twilio()
      
      const smsConfig = {
        ...mockNotificationConfig,
        channel: 'sms' as const,
        metadata: { recipient: '+1234567890' }
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'log-123' },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        return {} as any
      })

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'sms-123',
        status: 'sent'
      })

      await notificationService.send(smsConfig)

      const smsBody = mockTwilioInstance.messages.create.mock.calls[0][0].body
      expect(smsBody).toContain('🚨 CRITICAL Alert')
      expect(smsBody).toContain('Critical Data Accuracy Alert')
      expect(smsBody).toContain('https://app.truthsource.io/monitoring/alerts/alert-123')
    })

    it('should validate SMS action URL', async () => {
      const twilio = require('twilio')
      const mockTwilioInstance = twilio()
      
      const invalidUrlConfig = {
        ...mockNotificationConfig,
        channel: 'sms' as const,
        actionUrl: 'javascript:alert(1)',
        metadata: { recipient: '+1234567890' }
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'log-123' },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        return {} as any
      })

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'sms-123',
        status: 'sent'
      })

      await notificationService.send(invalidUrlConfig)

      const smsBody = mockTwilioInstance.messages.create.mock.calls[0][0].body
      expect(smsBody).not.toContain('View details:')
      expect(smsBody).not.toContain('javascript:')
    })
  })

  describe('Webhook security', () => {
    it('should reject non-HTTPS webhooks in production', async () => {
      process.env.NODE_ENV = 'production'
      
      const webhookConfig = {
        ...mockNotificationConfig,
        channel: 'webhook' as const,
        metadata: {
          recipient: 'http://insecure.example.com/webhook'
        }
      }

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'log-123' },
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      } as any)

      const result = await notificationService.send(webhookConfig)

      expect(result).toBe(false)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should reject localhost/internal webhooks in production', async () => {
      process.env.NODE_ENV = 'production'
      
      const internalUrls = [
        'https://localhost:3000/webhook',
        'https://127.0.0.1/webhook',
        'https://192.168.1.1/webhook',
        'https://10.0.0.1/webhook',
        'https://172.16.0.1/webhook'
      ]

      for (const url of internalUrls) {
        const webhookConfig = {
          ...mockNotificationConfig,
          channel: 'webhook' as const,
          metadata: { recipient: url }
        }

        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'log-123' },
                error: null
              })
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        } as any)

        const result = await notificationService.send(webhookConfig)

        expect(result).toBe(false)
      }
    })

    it('should include HMAC signature when secret provided', async () => {
      const webhookConfig = {
        ...mockNotificationConfig,
        channel: 'webhook' as const,
        metadata: {
          recipient: 'https://webhook.example.com/alerts',
          webhook_secret: 'secret-key'
        }
      }

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'log-123' },
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      } as any)

      const mockSignature = new Uint8Array([1, 2, 3, 4])
      ;(global.crypto.subtle.importKey as jest.Mock).mockResolvedValue('mock-key')
      ;(global.crypto.subtle.sign as jest.Mock).mockResolvedValue(mockSignature.buffer)
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map()
      })

      await notificationService.send(webhookConfig)

      expect(global.crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      expect(global.fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/alerts',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-TruthSource-Signature': 'sha256=01020304'
          })
        })
      )
    })
  })

  describe('Provider initialization', () => {
    it('should not initialize providers without credentials', () => {
      delete process.env.RESEND_API_KEY
      delete process.env.TWILIO_ACCOUNT_SID
      delete process.env.TWILIO_AUTH_TOKEN

      const service = new NotificationService()
      const providers = (service as any).providers

      expect(providers.has('email')).toBe(false)
      expect(providers.has('sms')).toBe(false)
      expect(providers.has('in_app')).toBe(true) // Always available
      expect(providers.has('webhook')).toBe(true) // Always available
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn(),
    channel: jest.fn()
  }
}