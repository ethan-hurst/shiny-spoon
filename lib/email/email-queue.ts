import { createClient } from '@/lib/supabase/server'

export interface EmailMessage {
  to: string | string[]
  from: string
  subject: string
  html?: string
  text?: string
  replyTo?: string
  cc?: string[]
  bcc?: string[]
}

export interface EmailQueueItem {
  id?: string
  message: EmailMessage
  status: 'pending' | 'processing' | 'sent' | 'failed'
  attempts: number
  max_attempts: number
  error?: string
  sent_at?: string
  created_at?: string
  updated_at?: string
}

/**
 * Queue an email for sending
 * This stores the email in the database to be processed by a background job
 */
export async function queueEmail(message: EmailMessage): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const queueItem: Omit<EmailQueueItem, 'id' | 'created_at' | 'updated_at'> = {
      message,
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
    }
    
    const { error } = await supabase
      .from('email_queue')
      .insert(queueItem)
      
    if (error) {
      console.error('Failed to queue email:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error queueing email:', error)
    return { success: false, error: 'Failed to queue email' }
  }
}

/**
 * Process pending emails from the queue
 * This would be called by a cron job or edge function
 */
export async function processEmailQueue(): Promise<void> {
  const supabase = createServerClient()
  
  // Get pending emails
  const { data: pendingEmails, error } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(10)
    
  if (error || !pendingEmails) {
    console.error('Failed to fetch pending emails:', error)
    return
  }
  
  for (const email of pendingEmails) {
    await processEmail(email)
  }
}

/**
 * Process a single email
 */
async function processEmail(queueItem: EmailQueueItem): Promise<void> {
  const supabase = createServerClient()
  
  // Update status to processing
  await supabase
    .from('email_queue')
    .update({ 
      status: 'processing',
      attempts: queueItem.attempts + 1,
    })
    .eq('id', queueItem.id)
    
  try {
    // Send the email using the configured provider
    await sendEmail(queueItem.message)
    
    // Mark as sent
    await supabase
      .from('email_queue')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', queueItem.id)
      
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Mark as failed if max attempts reached
    const status = queueItem.attempts + 1 >= queueItem.max_attempts ? 'failed' : 'pending'
    
    await supabase
      .from('email_queue')
      .update({ 
        status,
        error: errorMessage,
      })
      .eq('id', queueItem.id)
  }
}

/**
 * Validate email message fields
 */
function validateEmailMessage(message: EmailMessage): void {
  // Validate required fields
  if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
    throw new Error('Email recipient (to) is required')
  }
  
  if (!message.from) {
    throw new Error('Email sender (from) is required')
  }
  
  if (!message.subject || message.subject.trim() === '') {
    throw new Error('Email subject is required')
  }
  
  if (!message.html && !message.text) {
    throw new Error('Email must have either HTML or text content')
  }
  
  // Validate email format for all addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  const validateEmailAddress = (email: string, field: string) => {
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email address in ${field}: ${email}`)
    }
  }
  
  // Validate 'to' addresses
  const toAddresses = Array.isArray(message.to) ? message.to : [message.to]
  toAddresses.forEach(email => validateEmailAddress(email, 'to'))
  
  // Validate 'from' address
  validateEmailAddress(message.from, 'from')
  
  // Validate optional addresses if provided
  if (message.replyTo) {
    validateEmailAddress(message.replyTo, 'replyTo')
  }
  
  if (message.cc) {
    message.cc.forEach(email => validateEmailAddress(email, 'cc'))
  }
  
  if (message.bcc) {
    message.bcc.forEach(email => validateEmailAddress(email, 'bcc'))
  }
}

/**
 * Send email using the configured provider
 * This is where you would integrate with your email service
 */
async function sendEmail(message: EmailMessage): Promise<void> {
  // Validate the message before sending
  validateEmailMessage(message)
  
  const emailProvider = process.env.EMAIL_PROVIDER || 'console'
  
  switch (emailProvider) {
    case 'resend':
      const resendApiKey = process.env.RESEND_API_KEY
      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY environment variable is not configured')
      }
      
      // Send email via Resend API
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
          cc: message.cc,
          bcc: message.bcc,
        }),
      })
      
      if (!resendResponse.ok) {
        const errorData = await resendResponse.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(`Resend API error (${resendResponse.status}): ${errorData.message || resendResponse.statusText}`)
      }
      break
      
    case 'sendgrid':
      // Uncomment when SendGrid is configured
      // const sgMail = require('@sendgrid/mail')
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
      // await sgMail.send(message)
      throw new Error('SendGrid integration not configured')
      
    case 'ses':
      // Uncomment when AWS SES is configured
      // const aws = require('aws-sdk')
      // const ses = new aws.SES({ region: process.env.AWS_REGION })
      // await ses.sendEmail(convertToSESFormat(message)).promise()
      throw new Error('AWS SES integration not configured')
      
    case 'console':
      // Development mode - just log the email
      console.log('📧 Email would be sent:', {
        to: message.to,
        subject: message.subject,
        preview: message.text?.substring(0, 100) || message.html?.substring(0, 100),
      })
      break
      
    default:
      throw new Error(`Unknown email provider: ${emailProvider}`)
  }
}