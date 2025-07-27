import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'

// CSRF token validation helper
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  try {
    const headersList = headers()
    
    // Get CSRF token from header and cookie
    const csrfTokenFromHeader = headersList.get('x-csrf-token')
    const csrfTokenFromCookie = request.cookies.get('csrf-token')?.value
    
    // Both tokens must exist
    if (!csrfTokenFromHeader || !csrfTokenFromCookie) {
      return false
    }
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(csrfTokenFromHeader),
      Buffer.from(csrfTokenFromCookie)
    )
  } catch {
    return false
  }
}