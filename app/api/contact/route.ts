import { NextRequest, NextResponse } from 'next/server'
import { contactSchema } from '@/lib/schemas/contact'
import { createServerClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { queueEmail } from '@/lib/email/email-queue'

// Rate limiting: 5 submissions per hour per IP
const ratelimit = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN 
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      analytics: true,
    })
  : null

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    if (ratelimit) {
      const forwarded = request.headers.get('x-forwarded-for')
      const realIp = request.headers.get('x-real-ip')
      const ip = forwarded?.split(',')[0]?.trim() || realIp || '127.0.0.1'
      const { success, limit, reset, remaining } = await ratelimit.limit(ip)
      
      if (!success) {
        return NextResponse.json(
          { 
            error: 'Too many requests. Please try again later.',
            details: `Rate limit exceeded. Try again in ${Math.round((reset - Date.now()) / 1000 / 60)} minutes.`
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            }
          }
        )
      }
    }
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
        // Remove manual timestamp - let database handle created_at automatically
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
      text: `New Contact Form Submission\n\nName: ${validatedData.name}\nEmail: ${validatedData.email}\nCompany: ${validatedData.company}\nPhone: ${validatedData.phone || 'Not provided'}\nSubject: ${validatedData.subject}\n\nMessage:\n${validatedData.message}`,
    })
    
    if (!salesEmailResult.success) {
      console.error('Failed to queue sales notification email:', salesEmailResult.error)
    }
    
    // Queue auto-reply email to user
    const autoReplyResult = await queueEmail({
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
      text: `Thank you for reaching out!\n\nHi ${validatedData.name},\n\nWe've received your message and will get back to you within 24 hours.\n\nIn the meantime, feel free to explore our documentation at https://truthsource.io/docs or blog at https://truthsource.io/blog.\n\nBest regards,\nThe TruthSource Team`,
    })
    
    if (!autoReplyResult.success) {
      console.error('Failed to queue auto-reply email:', autoReplyResult.error)
    }
    
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