import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const feedbackSchema = z.object({
  articleId: z.string(),
  helpful: z.boolean(),
  feedback: z.string().optional(),
})

/**
 * Handles POST requests to submit feedback for an article.
 *
 * Validates the request body, associates feedback with the current user if available, and stores it in the database. Returns a success or error response based on the outcome.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = feedbackSchema.parse(body)
    
    const supabase = await createClient()
    
    // Get the current user (optional - feedback can be anonymous)
    const { data: { user } } = await supabase.auth.getUser()
    
    // Store feedback in database
    const { error } = await supabase
      .from('article_feedback')
      .insert({
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