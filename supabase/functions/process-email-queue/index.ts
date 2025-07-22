import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

    return { id: queueItem.id, status, error: errorMessage }
  }
}

async function sendEmail(message: any) {
  const emailProvider = Deno.env.get('EMAIL_PROVIDER') || 'console'

  switch (emailProvider) {
    case 'resend':
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY not configured')
      }

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      if (!resendResponse.ok) {
        const error = await resendResponse.text()
        throw new Error(`Resend API error: ${error}`)
      }
      break

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