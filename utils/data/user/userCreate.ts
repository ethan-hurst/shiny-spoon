'server only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { userCreateProps } from '@/utils/types'

export const userCreate = async ({
  email,
  first_name,
  last_name,
  profile_image_url,
  user_id,
}: userCreateProps) => {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  try {
    const { data, error } = await supabase
      .from('user')
      .insert([
        {
          email,
          first_name,
          last_name,
          profile_image_url,
          user_id,
        },
      ])
      .select()

    if (error) {
      // Log error details for monitoring without exposing sensitive data
      const errorInfo = {
        code: error.code,
        message: error.message,
        hint: error.hint,
        details: error.details,
        timestamp: new Date().toISOString(),
        operation: 'userCreate',
        user_email: email, // Only log email for troubleshooting
      }
      
      // In production, this would be sent to a proper logging service
      // For now, we'll use console.error with structured data
      console.error('[User Creation Error]', JSON.stringify(errorInfo, null, 2))
      
      return error
    }
    
    // Log success without exposing user data
    if (data && data.length > 0) {
      console.info('[User Creation Success]', {
        user_id: data[0].user_id,
        timestamp: new Date().toISOString(),
      })
    }
    
    return data
  } catch (error: any) {
    // Log unexpected errors with context
    console.error('[User Creation Exception]', {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })
    
    throw new Error(`Failed to create user: ${error.message}`)
  }
}
