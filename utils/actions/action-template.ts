'use server'

import { createClient } from '@/lib/supabase/server'

export async function actionTemplate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return 'You must be signed in'
  }

  try {
    let { data: userData, error } = await supabase.from('user').select('*')

    if (userData) return userData

    if (error) return error
  } catch (error: any) {
    throw new Error(error.message)
  }
}
