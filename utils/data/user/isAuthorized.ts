'server only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import config from '@/tailwind.config'

export const isAuthorized = async (
  userId: string
): Promise<{ authorized: boolean; message: string }> => {
  if (!config?.payments?.enabled) {
    return {
      authorized: true,
      message: 'Payments are disabled',
    }
  }

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
    // First check if user exists
    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(userId)

    if (userError || !userData.user) {
      return {
        authorized: false,
        message: 'User not found',
      }
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error?.code)
      return {
        authorized: false,
        message: error.message,
      }

    if (data && data[0].status === 'active') {
      return {
        authorized: true,
        message: 'User is subscribed',
      }
    }

    return {
      authorized: false,
      message: 'User is not subscribed',
    }
  } catch (error: any) {
    return {
      authorized: false,
      message: error.message,
    }
  }
}
