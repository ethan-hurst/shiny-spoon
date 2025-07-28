import { NextRequest } from 'next/server'
import { createRouteHandler, createPublicRouteHandler } from '@/lib/api/route-handler'

// Mock external dependencies
jest.mock('@/lib/utils/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user', email: 'test@example.com' } },
        error: null
      })
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { organization_id: 'test-org', role: 'admin' },
        error: null
      })
    }))
  }))
}))

jest.mock('@/lib/utils/ratelimit', () => ({
  ratelimit: {
    limit: jest.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000
    })
  }
}))

jest.mock('@/lib/utils/csrf', () => ({
  validateCSRFToken: jest.fn().mockResolvedValue(true)
}))

describe('createRouteHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle a simple GET request with authentication', async () => {
    const handler = createRouteHandler(
      async ({ user }) => {
        return new Response(JSON.stringify({ userId: user?.id }), {
          headers: { 'Content-Type': 'application/json' }
        })
      },
      { auth: true }
    )

    const request = new NextRequest('http://localhost/api/test', {
      method: 'GET'
    })

    const response = await handler(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.userId).toBe('test-user')
    expect(response.headers.get('X-Request-Id')).toBeTruthy()
  })

  it('should handle rate limiting when enabled', async () => {
    const { ratelimit } = require('@/lib/utils/ratelimit')
    ratelimit.limit.mockResolvedValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000
    })

    const handler = createRouteHandler(
      async () => new Response('OK'),
      { 
        rateLimit: { requests: 10, window: '1m' }
      }
    )

    const request = new NextRequest('http://localhost/api/test')
    const response = await handler(request)

    expect(response.status).toBe(429)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
  })

  it('should validate request body with Zod schema', async () => {
    const { z } = require('zod')
    
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email()
    })

    const handler = createRouteHandler(
      async ({ body }) => {
        return new Response(JSON.stringify({ message: `Hello ${body.name}` }))
      },
      { 
        schema: { body: schema }
      }
    )

    // Test with valid data
    const validRequest = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'John', email: 'john@example.com' })
    })

    const validResponse = await handler(validRequest)
    expect(validResponse.status).toBe(200)

    // Test with invalid data
    const invalidRequest = new NextRequest('http://localhost/api/test', {
      method: 'POST', 
      body: JSON.stringify({ name: '', email: 'invalid-email' })
    })

    const invalidResponse = await handler(invalidRequest)
    expect(invalidResponse.status).toBe(400)
    
    const errorData = await invalidResponse.json()
    expect(errorData.error).toBe('Validation failed')
    expect(errorData.issues).toBeDefined()
  })

  it('should handle CSRF protection for mutations', async () => {
    const { validateCSRFToken } = require('@/lib/utils/csrf')
    validateCSRFToken.mockResolvedValueOnce(false)

    const handler = createRouteHandler(
      async () => new Response('OK'),
      { csrf: true }
    )

    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST'
    })

    const response = await handler(request)
    expect(response.status).toBe(403)
    
    const data = await response.json()
    expect(data.error).toBe('Invalid or missing CSRF token')
  })
})

describe('createPublicRouteHandler', () => {
  it('should work without authentication', async () => {
    const handler = createPublicRouteHandler(
      async () => {
        return new Response(JSON.stringify({ message: 'public endpoint' }))
      }
    )

    const request = new NextRequest('http://localhost/api/public')
    const response = await handler(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.message).toBe('public endpoint')
  })

  it('should still apply rate limiting to public routes', async () => {
    const { ratelimit } = require('@/lib/utils/ratelimit')
    ratelimit.limit.mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60000
    })

    const handler = createPublicRouteHandler(
      async () => new Response('OK'),
      { 
        rateLimit: { requests: 5, window: '1m' }
      }
    )

    const request = new NextRequest('http://localhost/api/public')
    const response = await handler(request)

    expect(response.status).toBe(429)
  })
})