import { NextRequest, NextResponse } from 'next/server'
import { withApiMiddleware } from '@/lib/api/middleware'
import { ApiErrorCode, ApiScope, ApiTier } from '@/lib/api/types'
import { createClient } from '@/lib/supabase/server'

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn()
  }))
}))

// Mock Redis
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => ({
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1)
  }))
}))

// Mock Ratelimit
jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: {
    slidingWindow: jest.fn()
  }
}))

describe('API Middleware', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = createClient()
  })
  
  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products')
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' })
      )
      
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error.code).toBe(ApiErrorCode.AUTHENTICATION_FAILED)
    })
    
    it('should reject requests with invalid API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'invalid_key'
        }
      })
      
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' })
      )
      
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error.code).toBe(ApiErrorCode.INVALID_API_KEY)
    })
    
    it('should accept valid API key from header', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'sk_test123'
        }
      })
      
      const mockApiKey = {
        id: '123',
        tenant_id: 'tenant123',
        name: 'Test Key',
        scopes: [ApiScope.READ_PRODUCTS],
        tier: ApiTier.BASIC,
        rate_limit: { requests: 100, window: 3600 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      mockSupabase.single.mockResolvedValueOnce({ data: mockApiKey, error: null })
      
      const response = await withApiMiddleware(
        request,
        async (req, context) => {
          expect(context.tenantId).toBe('tenant123')
          expect(context.apiKey.name).toBe('Test Key')
          return NextResponse.json({ data: 'test' })
        }
      )
      
      expect(response.status).toBe(200)
    })
    
    it('should accept API key from Bearer token', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'Authorization': 'Bearer sk_test123'
        }
      })
      
      const mockApiKey = {
        id: '123',
        tenant_id: 'tenant123',
        name: 'Test Key',
        scopes: [ApiScope.READ_PRODUCTS],
        tier: ApiTier.BASIC,
        rate_limit: { requests: 100, window: 3600 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      mockSupabase.single.mockResolvedValueOnce({ data: mockApiKey, error: null })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' })
      )
      
      expect(response.status).toBe(200)
    })
    
    it('should reject expired API keys', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'sk_test123'
        }
      })
      
      const mockApiKey = {
        id: '123',
        tenant_id: 'tenant123',
        name: 'Test Key',
        scopes: [ApiScope.READ_PRODUCTS],
        tier: ApiTier.BASIC,
        rate_limit: { requests: 100, window: 3600 },
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      mockSupabase.single.mockResolvedValueOnce({ data: mockApiKey, error: null })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' })
      )
      
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error.code).toBe(ApiErrorCode.INVALID_API_KEY)
    })
  })
  
  describe('Authorization', () => {
    const mockApiKey = {
      id: '123',
      tenant_id: 'tenant123',
      name: 'Test Key',
      scopes: [ApiScope.READ_PRODUCTS],
      tier: ApiTier.BASIC,
      rate_limit: { requests: 100, window: 3600 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({ data: mockApiKey, error: null })
    })
    
    it('should allow access with required scopes', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'sk_test123'
        }
      })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' }),
        { requiredScopes: [ApiScope.READ_PRODUCTS] }
      )
      
      expect(response.status).toBe(200)
    })
    
    it('should deny access without required scopes', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'sk_test123'
        }
      })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' }),
        { requiredScopes: [ApiScope.WRITE_PRODUCTS] }
      )
      
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error.code).toBe(ApiErrorCode.INSUFFICIENT_SCOPE)
    })
    
    it('should allow admin scope to access everything', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'sk_test123'
        }
      })
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          ...mockApiKey,
          scopes: [ApiScope.ADMIN_ALL]
        },
        error: null
      })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' }),
        { requiredScopes: [ApiScope.WRITE_PRODUCTS, ApiScope.ADMIN_WEBHOOKS] }
      )
      
      expect(response.status).toBe(200)
    })
  })
  
  describe('IP Whitelisting', () => {
    it('should allow requests from whitelisted IPs', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'sk_test123',
          'X-Forwarded-For': '192.168.1.1'
        }
      })
      
      const mockApiKey = {
        id: '123',
        tenant_id: 'tenant123',
        name: 'Test Key',
        scopes: [ApiScope.READ_PRODUCTS],
        tier: ApiTier.BASIC,
        rate_limit: { requests: 100, window: 3600 },
        ip_whitelist: ['192.168.1.1'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      mockSupabase.single.mockResolvedValueOnce({ data: mockApiKey, error: null })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' })
      )
      
      expect(response.status).toBe(200)
    })
    
    it('should deny requests from non-whitelisted IPs', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'sk_test123',
          'X-Forwarded-For': '192.168.1.2'
        }
      })
      
      const mockApiKey = {
        id: '123',
        tenant_id: 'tenant123',
        name: 'Test Key',
        scopes: [ApiScope.READ_PRODUCTS],
        tier: ApiTier.BASIC,
        rate_limit: { requests: 100, window: 3600 },
        ip_whitelist: ['192.168.1.1'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      mockSupabase.single.mockResolvedValueOnce({ data: mockApiKey, error: null })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' })
      )
      
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error.code).toBe(ApiErrorCode.PERMISSION_DENIED)
    })
    
    it('should allow all IPs when whitelist is empty', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'sk_test123',
          'X-Forwarded-For': '10.0.0.1'
        }
      })
      
      const mockApiKey = {
        id: '123',
        tenant_id: 'tenant123',
        name: 'Test Key',
        scopes: [ApiScope.READ_PRODUCTS],
        tier: ApiTier.BASIC,
        rate_limit: { requests: 100, window: 3600 },
        ip_whitelist: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      mockSupabase.single.mockResolvedValueOnce({ data: mockApiKey, error: null })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' })
      )
      
      expect(response.status).toBe(200)
    })
  })
  
  describe('Skip Auth', () => {
    it('should skip authentication when configured', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/health')
      
      const response = await withApiMiddleware(
        request,
        async (req, context) => {
          expect(context.tenantId).toBe('')
          expect(context.scopes).toEqual([])
          return NextResponse.json({ status: 'healthy' })
        },
        { skipAuth: true }
      )
      
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('healthy')
    })
  })
  
  describe('Headers', () => {
    it('should add request ID header', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'X-API-Key': 'sk_test123'
        }
      })
      
      const mockApiKey = {
        id: '123',
        tenant_id: 'tenant123',
        name: 'Test Key',
        scopes: [ApiScope.READ_PRODUCTS],
        tier: ApiTier.BASIC,
        rate_limit: { requests: 100, window: 3600 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      mockSupabase.single.mockResolvedValueOnce({ data: mockApiKey, error: null })
      
      const response = await withApiMiddleware(
        request,
        async () => NextResponse.json({ data: 'test' })
      )
      
      expect(response.headers.get('X-Request-ID')).toBeTruthy()
      expect(response.headers.get('X-Request-ID')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })
  })
})