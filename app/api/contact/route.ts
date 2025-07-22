import { NextRequest, NextResponse } from 'next/server'
import { contactSchema } from '@/lib/schemas/contact'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate the request body
    const validatedData = contactSchema.parse(body)
    
    // Get supabase client
    const supabase = createServerClient()
    
    // Store contact submission in database
    const { error: dbError } = await supabase
      .from('contact_submissions')
      .insert({
        name: validatedData.name,
        email: validatedData.email,
        company: validatedData.company,
        phone: validatedData.phone,
        subject: validatedData.subject,
        message: validatedData.message,
        status: 'new',
        created_at: new Date().toISOString(),
      })
    
    if (dbError) {
      console.error('Database error:', dbError)
      // Don't expose database errors to client
    }
    
    // TODO: Send email notification using Resend or similar service
    // For now, we'll just log the submission
    console.log('Contact form submission:', validatedData)
    
    // In production, you would integrate with an email service like:
    // - Resend (https://resend.com)
    // - SendGrid
    // - AWS SES
    // - Postmark
    
    // Example with Resend (commented out):
    /*
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    await resend.emails.send({
      from: 'TruthSource <noreply@truthsource.io>',
      to: ['sales@truthsource.io'],
      subject: `New ${validatedData.subject} inquiry from ${validatedData.name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${validatedData.name}</p>
        <p><strong>Email:</strong> ${validatedData.email}</p>
        <p><strong>Company:</strong> ${validatedData.company}</p>
        <p><strong>Phone:</strong> ${validatedData.phone || 'Not provided'}</p>
        <p><strong>Subject:</strong> ${validatedData.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${validatedData.message}</p>
      `,
    })
    
    // Send auto-reply to user
    await resend.emails.send({
      from: 'TruthSource <noreply@truthsource.io>',
      to: [validatedData.email],
      subject: 'Thank you for contacting TruthSource',
      html: `
        <h2>Thank you for reaching out!</h2>
        <p>Hi ${validatedData.name},</p>
        <p>We've received your message and will get back to you within 24 hours.</p>
        <p>In the meantime, feel free to explore our <a href="https://truthsource.io/docs">documentation</a> or <a href="https://truthsource.io/blog">blog</a>.</p>
        <p>Best regards,<br>The TruthSource Team</p>
      `,
    })
    */
    
    return NextResponse.json(
      { message: 'Message sent successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Contact form error:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid form data' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}