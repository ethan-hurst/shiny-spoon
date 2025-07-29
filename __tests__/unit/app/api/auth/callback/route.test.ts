import { GET } from '@/app/api/auth/callback/route'

// Mock NextRequest
const mockNextRequest = (url: string) => {
  const urlObj = new URL(url)
  return {
    url: url,
    nextUrl: urlObj,
  } as any
}

// Mock Supabase client
const mockExchangeCodeForSession = jest.fn()
const mockGetUser = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockSingle = jest.fn()

const mockSupabase = {
  auth: {
    exchangeCodeForSession: mockExchangeCodeForSession,
    getUser: mockGetUser,
  },
  from: jest.fn().mockReturnValue({
    select: mockSelect.mockReturnValue({
      eq: mockEq.mockReturnValue({
        single: mockSingle,
      }),
    }),
  }),
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabase),
}))

describe('Auth Callback API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Error Handling', () => {
    it('should redirect to login with error when error parameter is present', async () => {
      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?error=access_denied&error_description=User%20denied%20access'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=access_denied&description=User%20denied%20access'
      )
    })

    it('should redirect to login when no code is provided', async () => {
      const request = mockNextRequest('http://localhost:3000/api/auth/callback')

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=no_code'
      )
    })

    it('should handle session exchange errors', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: { message: 'Invalid code' },
      })

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=invalid_code'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=session_error'
      )
    })

    it('should handle user fetch errors', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' },
      })

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=user_error'
      )
    })

    it('should handle profile fetch errors', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found' },
      })

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=profile_error'
      )
    })

    it('should handle unexpected errors', async () => {
      mockExchangeCodeForSession.mockRejectedValue(new Error('Database connection failed'))

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=unexpected_error'
      )
    })
  })

  describe('Successful Authentication', () => {
    it('should redirect to dashboard on successful authentication', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockSingle.mockResolvedValue({
        data: { user_id: 'user-123', name: 'Test User' },
        error: null,
      })

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })

    it('should redirect to custom next URL when provided', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockSingle.mockResolvedValue({
        data: { user_id: 'user-123', name: 'Test User' },
        error: null,
      })

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code&next=/settings'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('http://localhost:3000/settings')
    })

    it('should handle successful authentication with profile', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockSingle.mockResolvedValue({
        data: {
          user_id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      })

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })
  })

  describe('URL Parameter Handling', () => {
    it('should handle missing next parameter', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockSingle.mockResolvedValue({
        data: { user_id: 'user-123' },
        error: null,
      })

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })

    it('should handle empty error_description', async () => {
      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?error=access_denied'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=access_denied&description='
      )
    })

    it('should handle special characters in error_description', async () => {
      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?error=access_denied&error_description=User%20denied%20access%20with%20special%20chars%20%26%20symbols'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=access_denied&description=User%20denied%20access%20with%20special%20chars%20%26%20symbols'
      )
    })
  })

  describe('Database Interactions', () => {
    it('should query user_profiles table with correct parameters', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockSingle.mockResolvedValue({
        data: { user_id: 'user-123' },
        error: null,
      })

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code'
      )

      await GET(request)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles')
      expect(mockSelect).toHaveBeenCalledWith('*')
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(mockSingle).toHaveBeenCalled()
    })

    it('should handle database query errors gracefully', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=profile_error'
      )
    })
  })

  describe('Security and Validation', () => {
    it('should not expose sensitive information in error redirects', async () => {
      mockExchangeCodeForSession.mockRejectedValue(new Error('Database password: secret123'))

      const request = mockNextRequest(
        'http://localhost:3000/api/auth/callback?code=valid_code'
      )

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=unexpected_error'
      )
      // Should not expose the actual error message
      expect(response.headers.get('location')).not.toContain('secret123')
    })

    it('should handle malformed URLs gracefully', async () => {
      const request = mockNextRequest('http://localhost:3000/api/auth/callback?invalid=param')

      const response = await GET(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=no_code'
      )
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', async () => {
      // This test ensures the function signature is correct
      const request = mockNextRequest('http://localhost:3000/api/auth/callback')
      
      // Should not throw TypeScript errors
      const response = await GET(request)
      
      expect(response).toBeInstanceOf(Response)
      expect(typeof response.status).toBe('number')
      expect(typeof response.headers.get('location')).toBe('string')
    })
  })
})