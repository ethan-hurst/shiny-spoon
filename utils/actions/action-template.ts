'use server'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'

export async function actionTemplate() {
  const { userId } = await auth()

  if (!userId) {
    return 'You must be signed in'
  }

  const supabase = await createClient()

  try {
    let { data: user, error } = await supabase.from('user').select('*')

    if (user) return user

    if (error) return error
  } catch (error: any) {
    throw new Error(error.message)
  }
}
