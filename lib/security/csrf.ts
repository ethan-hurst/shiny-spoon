import { headers } from 'next/headers'

/**
 * Validates CSRF token for server actions
 * Next.js 13+ App Router has built-in CSRF protection for server actions,
 * but this provides an additional layer of validation
 */
export async function validateCsrfToken(): Promise<void> {
  const headersList = headers()
  
  // Check for required headers that indicate a legitimate server action call
  const contentType = headersList.get('content-type')
  const nextAction = headersList.get('next-action')
  
  // Server actions should have specific headers set by Next.js
  if (!nextAction && !contentType?.includes('multipart/form-data')) {
    throw new Error('Invalid request')
  }
  
  // Check origin/referer to prevent cross-site requests
  const origin = headersList.get('origin')
  const referer = headersList.get('referer')
  const host = headersList.get('host')
  
  if (origin && host) {
    const originUrl = new URL(origin)
    const expectedOrigin = `${originUrl.protocol}//${host}`
    
    if (origin !== expectedOrigin) {
      throw new Error('Cross-origin request not allowed')
    }
  }
  
  // Additional validation can be added here if needed
  return
}