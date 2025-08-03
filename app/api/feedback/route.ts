import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimiters } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

const feedbackSchema = z.object({
  articleId: z.string(),
  helpful: z.boolean(),
  feedback: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    if (rateLimiters.api) {
      const forwarded = request.headers.get('x-forwarded-for')
      const realIp = request.headers.get('x-real-ip')
      const ip = forwarded?.split(',')[0]?.trim() || realIp || '127.0.0.1'
      const { success, limit, reset, remaining } =
        await rateLimiters.api.limit(ip)

      if (!success) {
        return NextResponse.json(
          {
            error: 'Too many requests. Please try again later.',
            details: `Rate limit exceeded. Try again in ${Math.round((reset - Date.now()) / 1000 / 60)} minutes.`,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        )
      }
    }

    const body = await request.json()
    const validatedData = feedbackSchema.parse(body)

    const supabase = await createClient()

    // Get the current user (optional - feedback can be anonymous)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Store feedback in database
    const { error } = await supabase.from('article_feedback').insert({
      article_id: validatedData.articleId,
      helpful: validatedData.helpful,
      feedback: validatedData.feedback,
      user_id: user?.id,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Failed to save feedback:', error)
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Feedback saved successfully' },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid feedback data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Feedback API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
