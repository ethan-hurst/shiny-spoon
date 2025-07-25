'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Retrieves all user records from the database for an authenticated user.
 *
 * If no user is signed in, returns a message indicating authentication is required. On success, returns the user data; if a database error occurs, returns the error object. Throws an error if an unexpected exception is encountered.
 *
 * @returns An array of user records, an error object, or a string message if not authenticated.
 */
export async function actionTemplate() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
