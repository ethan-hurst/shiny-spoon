'server only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { userUpdateProps } from '@/utils/types'

export const userUpdate = async ({
  email,
  first_name,
  last_name,
  profile_image_url,
  user_id,
}: userUpdateProps) => {
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
      .update({
        email,
        first_name,
        last_name,
        profile_image_url,
        user_id,
      })
      .eq('user_id', user_id)
      .select()

    if (error) {
      throw new Error(error.message)
    }

    return data
  } catch (error: any) {
    throw new Error(error.message)
  }
}
