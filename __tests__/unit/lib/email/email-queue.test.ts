import { queueEmail, processEmailQueue } from '@/lib/email/email-queue'
import { createClient } from '@/lib/supabase/server'
import type { EmailMessage, EmailQueueItem } from '@/lib/email/email-queue'

jest.mock('@/lib/supabase/server')

// Mock fetch for email API calls
global.fetch = jest.fn()

describe('Email Queue', () => {
  let mockSupabase: any
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    
    // Mock Supabase client
    const emailQueueMock = {
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ 
        data: [], 
        error: null 
      })
    }
    
    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'email_queue') {
          return emailQueueMock
        }
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
          select: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      })
    }
    
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    
    // Default to console email provider
    process.env.EMAIL_PROVIDER = 'console'
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    delete process.env.EMAIL_PROVIDER
    delete process.env.RESEND_API_KEY
  })

  describe('queueEmail', () => {
    const validEmail: EmailMessage = {
      to: 'test@example.com',
      from: 'sender@example.com',
      subject: 'Test Email',
      html: '<p>Test content</p>',
      text: 'Test content'
    }

    it('should queue a valid email', async () => {
      // Mock successful insert
      const emailQueueMock = mockSupabase.from('email_queue')
      emailQueueMock.insert.mockResolvedValueOnce({ 
        data: { id: 'email-123' }, 
        error: null 
      })

      const result = await queueEmail(validEmail)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockSupabase.from).toHaveBeenCalledWith('email_queue')
      expect(emailQueueMock.insert).toHaveBeenCalledWith({
        message: validEmail,
        status: 'pending',
        attempts: 0,
        max_attempts: 3
      })
    })

    it('should handle array of recipients', async () => {
      // Mock successful insert
      const emailQueueMock = mockSupabase.from('email_queue')
      emailQueueMock.insert.mockResolvedValueOnce({ 
        data: { id: 'email-123' }, 
        error: null 
      })

      const emailWithMultipleRecipients: EmailMessage = {
        ...validEmail,
        to: ['user1@example.com', 'user2@example.com'],
        cc: ['cc1@example.com'],
        bcc: ['bcc1@example.com', 'bcc2@example.com']
      }

      const result = await queueEmail(emailWithMultipleRecipients)

      expect(result.success).toBe(true)
      expect(emailQueueMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: emailWithMultipleRecipients
        })
      )
    })

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed')
      const emailQueueMock = mockSupabase.from('email_queue')
      emailQueueMock.insert.mockResolvedValueOnce({ 
        error: { message: dbError.message } 
      })

      const result = await queueEmail(validEmail)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to queue email:', expect.any(Object))
    })

    it('should handle unexpected errors', async () => {
      mockSupabase.from.mockImplementationOnce(() => {
        throw new Error('Unexpected error')
      })

      const result = await queueEmail(validEmail)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to queue email')
    })
  })

  describe('processEmailQueue', () => {
    it('should process pending emails', async () => {
      const pendingEmails: EmailQueueItem[] = [
        {
          id: 'email-1',
          message: {
            to: 'test1@example.com',
            from: 'sender@example.com',
            subject: 'Test 1',
            text: 'Content 1'
          },
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        },
        {
          id: 'email-2',
          message: {
            to: 'test2@example.com',
            from: 'sender@example.com',
            subject: 'Test 2',
            html: '<p>Content 2</p>'
          },
          status: 'pending',
          attempts: 1,
          max_attempts: 3
        }
      ]

      // Mock the select chain
      mockSupabase.from('email_queue').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          lt: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: pendingEmails,
                error: null
              })
            })
          })
        })
      })

      // Mock successful updates
      mockSupabase.from('email_queue').update.mockResolvedValue({ data: null, error: null })

      await processEmailQueue()

      // Should fetch pending emails with correct filters
      expect(mockSupabase.from).toHaveBeenCalledWith('email_queue')
      expect(mockSupabase.from('email_queue').select).toHaveBeenCalledWith('*')
      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledTimes(4) // 2 processing + 2 sent
      
      // Should log emails in console mode
      expect(consoleLogSpy).toHaveBeenCalledTimes(2)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '📧 Email would be sent:',
        expect.objectContaining({
          subject: 'Test 1'
        })
      )
    })

    it('should handle empty queue', async () => {
      mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
        data: [],
        error: null
      })

      await processEmailQueue()

      // Should not attempt to process any emails
      expect(mockSupabase.from('email_queue').update).not.toHaveBeenCalled()
    })

    it('should handle database errors when fetching', async () => {
      // Mock the select chain with error
      mockSupabase.from('email_queue').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          lt: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Database error')
              })
            })
          })
        })
      })

      await processEmailQueue()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch pending emails:',
        expect.any(Error)
      )
    })

    it('should mark email as failed after max attempts', async () => {
      const failingEmail: EmailQueueItem = {
        id: 'email-fail',
        message: {
          to: 'invalid@',  // Invalid email
          from: 'sender@example.com',
          subject: 'Test',
          text: 'Content'
        },
        status: 'pending',
        attempts: 2,  // Already tried twice
        max_attempts: 3
      }

      // Mock the select chain
      mockSupabase.from('email_queue').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          lt: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [failingEmail],
                error: null
              })
            })
          })
        })
      })

      // Mock successful updates
      mockSupabase.from('email_queue').update.mockResolvedValue({ data: null, error: null })

      await processEmailQueue()

      // Should update status to processing
      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith({
        status: 'processing',
        attempts: 3
      })

      // Should update status to failed (not pending) since max attempts reached
      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith({
        status: 'failed',
        error: expect.stringContaining('Invalid email address')
      })
    })
  })

  describe('email validation', () => {
    it('should reject emails without recipients', async () => {
      const invalidEmail: EmailMessage = {
        to: [],
        from: 'sender@example.com',
        subject: 'Test',
        html: '<p>Content</p>'
      }

      // Queue will succeed (validation happens during send)
      await queueEmail(invalidEmail)

      // But processing should fail
      // Mock the select chain
      mockSupabase.from('email_queue').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          lt: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'test-1',
                  message: invalidEmail,
                  status: 'pending',
                  attempts: 0,
                  max_attempts: 3
                }],
                error: null
              })
            })
          })
        })
      })

      // Mock successful updates
      mockSupabase.from('email_queue').update.mockResolvedValue({ data: null, error: null })

      await processEmailQueue()

      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          error: 'Email recipient (to) is required'
        })
      )
    })

    it('should reject emails without sender', async () => {
      const invalidEmail: EmailMessage = {
        to: 'test@example.com',
        from: '',
        subject: 'Test',
        text: 'Content'
      }

      mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
        data: [{
          id: 'test-1',
          message: invalidEmail,
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        }],
        error: null
      })

      await processEmailQueue()

      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Email sender (from) is required'
        })
      )
    })

    it('should reject emails without subject', async () => {
      const invalidEmail: EmailMessage = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: '   ',  // Only whitespace
        html: '<p>Content</p>'
      }

      mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
        data: [{
          id: 'test-1',
          message: invalidEmail,
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        }],
        error: null
      })

      await processEmailQueue()

      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Email subject is required'
        })
      )
    })

    it('should reject emails without content', async () => {
      const invalidEmail: EmailMessage = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test'
        // No html or text
      }

      mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
        data: [{
          id: 'test-1',
          message: invalidEmail,
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        }],
        error: null
      })

      await processEmailQueue()

      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Email must have either HTML or text content'
        })
      )
    })

    it('should validate email formats', async () => {
      const invalidFormats = [
        { to: 'notanemail', expectedError: 'Invalid email address in to' },
        { from: 'sender@', expectedError: 'Invalid email address in from' },
        { replyTo: '@example.com', expectedError: 'Invalid email address in replyTo' },
        { cc: ['valid@example.com', 'invalid@'], expectedError: 'Invalid email address in cc' },
        { bcc: ['missing-at-sign.com'], expectedError: 'Invalid email address in bcc' }
      ]

      for (const testCase of invalidFormats) {
        const email: EmailMessage = {
          to: testCase.to || 'valid@example.com',
          from: testCase.from || 'valid@example.com',
          subject: 'Test',
          text: 'Content',
          replyTo: testCase.replyTo,
          cc: testCase.cc,
          bcc: testCase.bcc
        }

        mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
          data: [{
            id: 'test-1',
            message: email,
            status: 'pending',
            attempts: 0,
            max_attempts: 3
          }],
          error: null
        })

        await processEmailQueue()

        expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining(testCase.expectedError)
          })
        )
      }
    })
  })

  describe('email providers', () => {
    it('should send via console in development', async () => {
      process.env.EMAIL_PROVIDER = 'console'

      const email: EmailMessage = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test Email',
        text: 'This is a test email with a longer content to test the preview functionality'
      }

      mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
        data: [{
          id: 'test-1',
          message: email,
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        }],
        error: null
      })

      await processEmailQueue()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '📧 Email would be sent:',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Email',
          preview: 'This is a test email with a longer content to test the preview functionality'
        })
      )
    })

    it('should send via Resend when configured', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.RESEND_API_KEY = 'test-api-key'

      const email: EmailMessage = {
        to: ['user1@example.com', 'user2@example.com'],
        from: 'sender@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
        replyTo: 'replyto@example.com',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com']
      }

      mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
        data: [{
          id: 'test-1',
          message: email,
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        }],
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-123' })
      })

      await processEmailQueue()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(email)
        })
      )

      // Should mark as sent
      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          sent_at: expect.any(String)
        })
      )
    })

    it('should handle Resend API errors', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.RESEND_API_KEY = 'test-api-key'

      const email: EmailMessage = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Content'
      }

      mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
        data: [{
          id: 'test-1',
          message: email,
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        }],
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid API key' })
      })

      await processEmailQueue()

      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          error: 'Resend API error (401): Invalid API key'
        })
      )
    })

    it('should throw error if Resend API key not configured', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      // No API key set

      const email: EmailMessage = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Content'
      }

      mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
        data: [{
          id: 'test-1',
          message: email,
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        }],
        error: null
      })

      await processEmailQueue()

      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'RESEND_API_KEY environment variable is not configured'
        })
      )
    })

    it('should handle unsupported providers', async () => {
      process.env.EMAIL_PROVIDER = 'unknown-provider'

      const email: EmailMessage = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Content'
      }

      mockSupabase.from('email_queue').limit.mockResolvedValueOnce({
        data: [{
          id: 'test-1',
          message: email,
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        }],
        error: null
      })

      await processEmailQueue()

      expect(mockSupabase.from('email_queue').update).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unknown email provider: unknown-provider'
        })
      )
    })
  })
})