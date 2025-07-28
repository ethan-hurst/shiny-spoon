import { NextResponse } from 'next/server'
import { createPublicRouteHandler } from '@/lib/api/route-handler'
import { contactSchema } from '@/lib/schemas/contact'
import { createClient } from '@/lib/supabase/server'
import { queueEmail } from '@/lib/email/email-queue'

export const POST = createPublicRouteHandler(
  async ({ body }) => {
    // Get supabase client
    const supabase = await createClient()
    
    // Store contact submission in database
    const { error: dbError } = await supabase
      .from('contact_submissions')
      .insert({
        name: body.name,
        email: body.email,
        company: body.company,
        phone: body.phone,
        subject: body.subject,
        message: body.message,
        status: 'new',
      })
    
    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to save your message. Please try again.' },
        { status: 500 }
      )
    }
    
    // Queue email notification to sales team
    const salesEmailResult = await queueEmail({
      from: 'TruthSource <noreply@truthsource.io>',
      to: ['sales@truthsource.io'],
      subject: `New ${body.subject} inquiry from ${body.name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${body.name}</p>
        <p><strong>Email:</strong> ${body.email}</p>
        <p><strong>Company:</strong> ${body.company}</p>
        <p><strong>Phone:</strong> ${body.phone || 'Not provided'}</p>
        <p><strong>Subject:</strong> ${body.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${body.message}</p>
      `,
      text: `New Contact Form Submission\n\nName: ${body.name}\nEmail: ${body.email}\nCompany: ${body.company}\nPhone: ${body.phone || 'Not provided'}\nSubject: ${body.subject}\n\nMessage:\n${body.message}`,
    })
    
    if (!salesEmailResult.success) {
      console.error('Failed to queue sales notification email:', salesEmailResult.error)
    }
    
    // Queue auto-reply email to user
    const autoReplyResult = await queueEmail({
      from: 'TruthSource <noreply@truthsource.io>',
      to: [body.email],
      subject: 'Thank you for contacting TruthSource',
      html: `
        <h2>Thank you for reaching out!</h2>
        <p>Hi ${body.name},</p>
        <p>We've received your message and will get back to you within 24 hours.</p>
        <p>In the meantime, feel free to explore our <a href="https://truthsource.io/docs">documentation</a> or <a href="https://truthsource.io/blog">blog</a>.</p>
        <p>Best regards,<br>The TruthSource Team</p>
      `,
      text: `Thank you for reaching out!\n\nHi ${body.name},\n\nWe've received your message and will get back to you within 24 hours.\n\nIn the meantime, feel free to explore our documentation at https://truthsource.io/docs or blog at https://truthsource.io/blog.\n\nBest regards,\nThe TruthSource Team`,
    })
    
    if (!autoReplyResult.success) {
      console.error('Failed to queue auto-reply email:', autoReplyResult.error)
    }
    
    return NextResponse.json(
      { message: 'Message sent successfully' },
      { status: 200 }
    )
  },
  {
    schema: { body: contactSchema },
    rateLimit: { 
      requests: 5, 
      window: '1h',
      identifier: (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                            req.headers.get('x-real-ip') || 
                            'anonymous'
    }
  }
)