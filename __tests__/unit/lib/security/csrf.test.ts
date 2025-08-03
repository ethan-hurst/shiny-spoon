import { headers } from 'next/headers'
import { validateCsrfToken } from '@/lib/security/csrf'

// Mock Next.js headers
jest.mock('next/headers', () => ({
  headers: jest.fn(),
}))

describe('CSRF Protection', () => {
  let mockHeaders: jest.Mock
  let headerMap: Map<string, string>

  beforeEach(() => {
    jest.clearAllMocks()
    headerMap = new Map()
    mockHeaders = headers as jest.Mock
    mockHeaders.mockReturnValue({
      get: (key: string) => headerMap.get(key.toLowerCase()),
    })
  })

  describe('validateCsrfToken', () => {
    it('should validate request with next-action header', async () => {
      headerMap.set('next-action', 'some-action-id')

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should validate request with multipart/form-data content type', async () => {
      headerMap.set(
        'content-type',
        'multipart/form-data; boundary=----WebKitFormBoundary'
      )

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should reject request without required headers', async () => {
      // No next-action or multipart/form-data headers
      headerMap.set('content-type', 'application/json')

      await expect(validateCsrfToken()).rejects.toThrow('Invalid request')
    })

    it('should validate same-origin requests', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('origin', 'https://example.com')
      headerMap.set('host', 'example.com')

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should validate same-origin with different protocols', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('origin', 'http://localhost:3000')
      headerMap.set('host', 'localhost:3000')

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should reject cross-origin requests', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('origin', 'https://malicious.com')
      headerMap.set('host', 'example.com')

      await expect(validateCsrfToken()).rejects.toThrow(
        'Cross-origin request not allowed'
      )
    })

    it('should reject mismatched origin and host', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('origin', 'https://evil.com')
      headerMap.set('host', 'trusted.com')

      await expect(validateCsrfToken()).rejects.toThrow(
        'Cross-origin request not allowed'
      )
    })

    it('should handle requests without origin header', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('host', 'example.com')
      // No origin header - common for same-origin requests

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should handle requests with referer but no origin', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('referer', 'https://example.com/page')
      headerMap.set('host', 'example.com')

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should validate multipart form data with various boundaries', async () => {
      const contentTypes = [
        'multipart/form-data',
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
        'multipart/form-data;boundary=----FormBoundary',
        'multipart/form-data; charset=utf-8; boundary=----Boundary',
      ]

      for (const contentType of contentTypes) {
        headerMap.clear()
        headerMap.set('content-type', contentType)

        await expect(validateCsrfToken()).resolves.toBeUndefined()
      }
    })

    it('should handle case-insensitive header names', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('origin', 'https://example.com')
      headerMap.set('host', 'example.com')

      // Mock headers with different casing
      mockHeaders.mockReturnValue({
        get: (key: string) => {
          const lowerKey = key.toLowerCase()
          if (lowerKey === 'next-action') return 'action-id'
          if (lowerKey === 'origin') return 'https://example.com'
          if (lowerKey === 'host') return 'example.com'
          return undefined
        },
      })

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should handle origin with port numbers', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('origin', 'http://localhost:3000')
      headerMap.set('host', 'localhost:3000')

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should reject when origin port mismatches host', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('origin', 'http://localhost:3000')
      headerMap.set('host', 'localhost:4000')

      await expect(validateCsrfToken()).rejects.toThrow(
        'Cross-origin request not allowed'
      )
    })

    it('should handle both next-action and multipart headers present', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set(
        'content-type',
        'multipart/form-data; boundary=----WebKitFormBoundary'
      )
      headerMap.set('origin', 'https://example.com')
      headerMap.set('host', 'example.com')

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should reject non-multipart content types', async () => {
      const invalidContentTypes = [
        'application/json',
        'text/html',
        'application/x-www-form-urlencoded',
        'text/plain',
      ]

      for (const contentType of invalidContentTypes) {
        headerMap.clear()
        headerMap.set('content-type', contentType)

        await expect(validateCsrfToken()).rejects.toThrow('Invalid request')
      }
    })

    it('should handle missing host header gracefully', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('origin', 'https://example.com')
      // No host header

      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })

    it('should validate requests with trailing slashes in origin', async () => {
      headerMap.set('next-action', 'action-id')
      headerMap.set('origin', 'https://example.com/')
      headerMap.set('host', 'example.com')

      // Should handle trailing slash in origin URL
      await expect(validateCsrfToken()).resolves.toBeUndefined()
    })
  })
})
