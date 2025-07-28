import { NextResponse } from 'next/server'
import { createPublicRouteHandler } from '@/lib/api/route-handler'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const feedbackSchema = z.object({
  articleId: z.string(),
  helpful: z.boolean(),
  feedback: z.string().optional(),
})

export const POST = createPublicRouteHandler(
  async ({ body, request }) => {
    const supabase = await createClient()
    
    // Get the current user (optional - feedback can be anonymous)
    const { data: { user } } = await supabase.auth.getUser()
    
    // Store feedback in database
    const { error } = await supabase
      .from('article_feedback')
      .insert({
        article_id: body.articleId,
        helpful: body.helpful,
        feedback: body.feedback,
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
  },
  {
    schema: { body: feedbackSchema },
    rateLimit: { 
      requests: 10, 
      window: '5m',
      identifier: (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                            req.headers.get('x-real-ip') || 
                            'anonymous'
    }
  }
)