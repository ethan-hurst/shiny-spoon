import crypto from 'crypto'
import { headers } from 'next/headers'
import { NextRequest } from 'next/server'

/**
 * Validates the CSRF token in an incoming request by comparing the token from the request header with the token from the request cookie using a timing-safe comparison.
 *
 * @param request - The incoming Next.js request object containing headers and cookies
 * @returns `true` if both tokens exist and match; otherwise, `false`
 */
export async function validateCSRFToken(
  request: NextRequest
): Promise<boolean> {
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
