/// <reference path="../types/deno.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Validate required environment variables
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is not configured')
    }

    if (!supabaseServiceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY environment variable is not configured'
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get pending emails
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(10)

    if (fetchError) {
      throw new Error(`Failed to fetch pending emails: ${fetchError.message}`)
    }

    const results = []
    for (const email of pendingEmails || []) {
      const result = await processEmail(supabase, email)
      results.push(result)
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function processEmail(supabase: any, queueItem: any) {
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

    return { id: queueItem.id, status: 'sent' }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    // Mark as failed if max attempts reached
    const status =
      queueItem.attempts + 1 >= queueItem.max_attempts ? 'failed' : 'pending'

    await supabase
      .from('email_queue')
      .update({
        status,
        error: errorMessage,
      })
      .eq('id', queueItem.id)

    return { id: queueItem.id, status, error: errorMessage }
  }
}

/**
 * Validate email message fields
 */
function validateEmailMessage(message: any): void {
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
  toAddresses.forEach((email: string) => validateEmailAddress(email, 'to'))

  // Validate 'from' address
  validateEmailAddress(message.from, 'from')

  // Validate optional addresses if provided
  if (message.replyTo) {
    validateEmailAddress(message.replyTo, 'replyTo')
  }

  if (message.cc && Array.isArray(message.cc)) {
    message.cc.forEach((email: string) => validateEmailAddress(email, 'cc'))
  }

  if (message.bcc && Array.isArray(message.bcc)) {
    message.bcc.forEach((email: string) => validateEmailAddress(email, 'bcc'))
  }
}

async function sendEmail(message: any) {
  try {
    // Validate the message before sending
    validateEmailMessage(message)

    const emailProvider = Deno.env.get('EMAIL_PROVIDER') || 'console'

    switch (emailProvider) {
      case 'resend':
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (!resendApiKey) {
          throw new Error(
            'RESEND_API_KEY environment variable is not configured'
          )
        }

        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
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
            let errorMessage = `HTTP ${resendResponse.status}: ${resendResponse.statusText}`
            try {
              const errorData = await resendResponse.json()
              errorMessage = `Resend API error (${resendResponse.status}): ${errorData.message || errorData.error || resendResponse.statusText}`
            } catch {
              // If parsing JSON fails, use the text response
              const errorText = await resendResponse.text()
              if (errorText) {
                errorMessage = `Resend API error (${resendResponse.status}): ${errorText}`
              }
            }
            throw new Error(errorMessage)
          }

          // Log successful send in development
          if (Deno.env.get('ENVIRONMENT') === 'development') {
            console.log('✅ Email sent successfully via Resend:', {
              to: message.to,
              subject: message.subject,
            })
          }
        } catch (fetchError) {
          // Handle network errors
          if (
            fetchError instanceof TypeError &&
            fetchError.message.includes('fetch')
          ) {
            throw new Error(
              `Network error connecting to Resend API: ${fetchError.message}`
            )
          }
          throw fetchError
        }
        break

      case 'console':
        // Development mode - just log the email
        console.log('📧 Email would be sent:', {
          to: message.to,
          from: message.from,
          subject: message.subject,
          preview:
            message.text?.substring(0, 100) || message.html?.substring(0, 100),
        })
        break

      default:
        throw new Error(
          `Unknown email provider: ${emailProvider}. Supported providers are: resend, console`
        )
    }
  } catch (error) {
    // Log the error for debugging
    console.error('Email send error:', error)

    // Re-throw with a more descriptive message if needed
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error(`Failed to send email: ${String(error)}`)
    }
  }
}
