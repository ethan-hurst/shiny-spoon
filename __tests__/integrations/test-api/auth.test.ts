/**
 * TestApi Auth tests
 */

import { TestApiAuth } from '@/lib/integrations/test-api/auth'

describe('TestApiAuth', () => {
  let auth: TestApiAuth
  
  beforeEach(() => {
    auth = new TestApiAuth({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com'
    })
  })

  describe('authentication', () => {
    it('should authenticate with valid credentials', async () => {
      jest.spyOn(auth as any, 'makeRequest').mockResolvedValue({
        data: { access_token: 'token123', expires_in: 3600 }
      })
      
      const result = await auth.authenticate()
      expect(result).toBe(true)
      expect(auth.isAuthenticated()).toBe(true)
    })

    it('should handle authentication failure', async () => {
      jest.spyOn(auth as any, 'makeRequest').mockRejectedValue(
        new Error('Invalid credentials')
      )
      
      await expect(auth.authenticate()).rejects.toThrow('Invalid credentials')
    })
  })

  describe('token management', () => {
    it('should refresh token when expired', async () => {
      // Set expired token
      ;(auth as any).token = 'expired-token'
      ;(auth as any).tokenExpiry = Date.now() - 1000
      
      jest.spyOn(auth as any, 'refreshToken').mockResolvedValue({
        access_token: 'new-token',
        expires_in: 3600
      })
      
      const token = await auth.getValidToken()
      expect(token).toBe('new-token')
    })

    it('should return existing token if not expired', async () => {
      const futureExpiry = Date.now() + 3600000
      ;(auth as any).token = 'valid-token'
      ;(auth as any).tokenExpiry = futureExpiry
      
      const token = await auth.getValidToken()
      expect(token).toBe('valid-token')
    })
  })
})
