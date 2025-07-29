import { NetSuiteAuth } from '@/lib/integrations/netsuite/auth'
import { AuthManager } from '@/lib/integrations/auth-manager'
import { createClient } from '@/lib/supabase/server'
import { AuthenticationError } from '@/types/integration.types'
import type { NetSuiteIntegrationConfig } from '@/types/netsuite.types'
import { z } from 'zod'

// Mock dependencies
jest.mock('@/lib/integrations/auth-manager')
jest.mock('@/lib/supabase/server')

// Mock fetch
global.fetch = jest.fn()

// Mock crypto
global.crypto = {
  getRandomValues: jest.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
    return array
  })
} as any

// Mock Buffer for Node.js environment
global.Buffer = Buffer

describe('NetSuiteAuth', () => {
  let netSuiteAuth: NetSuiteAuth
  let mockAuthManager: jest.Mocked<AuthManager>
  let mockSupabase: ReturnType<typeof createMockSupabase>
  
  const integrationId = 'integration-123'
  const organizationId = 'org-123'
  const config: NetSuiteIntegrationConfig = {
    account_id: 'TSTDRV123456',
    datacenter_url: 'https://tstdrv123456.suitetalk.api.netsuite.com',
    consumer_key: 'consumer-key',
    consumer_secret: 'consumer-secret',
    token_id: 'token-id',
    token_secret: 'token-secret'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variable
    process.env.NEXT_PUBLIC_URL = 'https://app.example.com'
    
    mockSupabase = createMockSupabase()
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    
    mockAuthManager = {
      getCredentials: jest.fn(),
      storeCredentials: jest.fn(),
      deleteCredentials: jest.fn(),
      rotateCredentials: jest.fn()
    } as any
    
    ;(AuthManager as jest.Mock).mockImplementation(() => mockAuthManager)
    
    netSuiteAuth = new NetSuiteAuth(integrationId, organizationId, config)
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_URL
  })

  describe('initialize', () => {
    it('should initialize with OAuth credentials', async () => {
      const oauthCreds = {
        credential_type: 'oauth2',
        client_id: 'client-id',
        client_secret: 'client-secret',
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      }
      
      mockAuthManager.getCredentials.mockResolvedValue(oauthCreds)
      
      await netSuiteAuth.initialize()
      
      expect(mockAuthManager.getCredentials).toHaveBeenCalled()
    })

    it('should throw error if no credentials found', async () => {
      mockAuthManager.getCredentials.mockResolvedValue(null)
      
      await expect(netSuiteAuth.initialize()).rejects.toThrow('OAuth credentials not found')
    })

    it('should throw error if credentials are not OAuth type', async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'api_key',
        api_key: 'key'
      } as any)
      
      await expect(netSuiteAuth.initialize()).rejects.toThrow('OAuth credentials not found')
    })

    it('should wrap non-Error exceptions', async () => {
      mockAuthManager.getCredentials.mockRejectedValue('String error')
      
      await expect(netSuiteAuth.initialize()).rejects.toThrow(AuthenticationError)
    })
  })

  describe('getAuthorizationUrl', () => {
    beforeEach(async () => {
      // Initialize with mock credentials
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        client_id: 'client-id',
        client_secret: 'client-secret',
        access_token: 'token'
      })
      await netSuiteAuth.initialize()
    })

    it('should generate correct authorization URL', () => {
      const state = 'random-state-123'
      const url = netSuiteAuth.getAuthorizationUrl(state)
      
      expect(url).toContain('https://TSTDRV123456.app.netsuite.com/app/login/oauth2/authorize.nl')
      expect(url).toContain('response_type=code')
      expect(url).toContain('client_id=client-id')
      expect(url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fintegrations%2Fnetsuite%2Fcallback')
      expect(url).toContain('scope=rest_webservices')
      expect(url).toContain(`state=${state}`)
    })

    it('should encode URL parameters correctly', () => {
      const state = 'state-with-special-chars!@#'
      const url = netSuiteAuth.getAuthorizationUrl(state)
      
      const urlObj = new URL(url)
      expect(urlObj.searchParams.get('state')).toBe(state)
    })
  })

  describe('exchangeCodeForTokens', () => {
    beforeEach(async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        client_id: 'client-id',
        client_secret: 'client-secret',
        access_token: 'token'
      })
      await netSuiteAuth.initialize()
    })

    it('should exchange code for tokens successfully', async () => {
      const code = 'auth-code-123'
      const tokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'rest_webservices'
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => tokenResponse
      })
      
      const result = await netSuiteAuth.exchangeCodeForTokens(code)
      
      expect(result).toEqual(tokenResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://TSTDRV123456.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': expect.stringContaining('Basic ')
          }
        })
      )
      
      expect(mockAuthManager.storeCredentials).toHaveBeenCalledWith('oauth2', expect.objectContaining({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: expect.any(String)
      }))
    })

    it('should handle token exchange errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'invalid_grant' })
      })
      
      await expect(netSuiteAuth.exchangeCodeForTokens('bad-code'))
        .rejects.toThrow('Token exchange failed: 401')
    })

    it('should validate token response schema', async () => {
      const invalidResponses = [
        { access_token: '' }, // Empty access token
        { access_token: 'token', refresh_token: '' }, // Empty refresh token
        { access_token: 'token', refresh_token: 'refresh' }, // Missing expires_in
        { access_token: 'token', refresh_token: 'refresh', expires_in: 'not-a-number' }
      ]
      
      for (const response of invalidResponses) {
        ;(global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => response
        })
        
        await expect(netSuiteAuth.exchangeCodeForTokens('code'))
          .rejects.toThrow('Invalid token response format')
      }
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
      
      await expect(netSuiteAuth.exchangeCodeForTokens('code'))
        .rejects.toThrow('Failed to exchange code for tokens')
    })
  })

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      const currentCreds = {
        credential_type: 'oauth2',
        client_id: 'client-id',
        client_secret: 'client-secret',
        access_token: 'old-token',
        refresh_token: 'refresh-token'
      }
      
      mockAuthManager.getCredentials.mockResolvedValue(currentCreds)
      await netSuiteAuth.initialize()
      
      const tokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => tokenResponse
      })
      
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await netSuiteAuth.refreshAccessToken()
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/rest/auth/oauth2/v1/token'),
        expect.objectContaining({
          body: expect.any(URLSearchParams)
        })
      )
      
      const body = (global.fetch as jest.Mock).mock.calls[0][1].body
      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('refresh_token')).toBe('refresh-token')
      
      expect(mockAuthManager.storeCredentials).toHaveBeenCalledWith('oauth2', expect.objectContaining({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      }))
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_integration_activity', expect.objectContaining({
        p_message: 'NetSuite OAuth token refreshed successfully'
      }))
    })

    it('should throw error if no refresh token available', async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        client_id: 'client-id',
        client_secret: 'client-secret',
        access_token: 'token'
        // No refresh token
      })
      
      await expect(netSuiteAuth.refreshAccessToken())
        .rejects.toThrow('Refresh token not available')
    })

    it('should log refresh failures', async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        client_id: 'client-id',
        client_secret: 'client-secret',
        access_token: 'token',
        refresh_token: 'refresh-token'
      })
      
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      })
      
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await expect(netSuiteAuth.refreshAccessToken())
        .rejects.toThrow('Token refresh failed: 400')
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_integration_activity', expect.objectContaining({
        p_severity: 'error',
        p_message: 'NetSuite OAuth token refresh failed'
      }))
    })
  })

  describe('getValidAccessToken', () => {
    it('should return current token if not expired', async () => {
      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 1)
      
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        access_token: 'valid-token',
        expires_at: futureDate.toISOString()
      })
      
      const token = await netSuiteAuth.getValidAccessToken()
      
      expect(token).toBe('valid-token')
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should refresh token if expired', async () => {
      const expiredDate = new Date()
      expiredDate.setMinutes(expiredDate.getMinutes() + 3) // Within 5 minute threshold
      
      mockAuthManager.getCredentials
        .mockResolvedValueOnce({
          credential_type: 'oauth2',
          client_id: 'client-id',
          client_secret: 'client-secret',
          access_token: 'old-token',
          refresh_token: 'refresh-token',
          expires_at: expiredDate.toISOString()
        })
        .mockResolvedValueOnce({
          credential_type: 'oauth2',
          access_token: 'new-token'
        })
      
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      })
      
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await netSuiteAuth.initialize()
      const token = await netSuiteAuth.getValidAccessToken()
      
      expect(token).toBe('new-token')
      expect(mockAuthManager.storeCredentials).toHaveBeenCalled()
    })

    it('should handle tokens without expiry', async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        access_token: 'no-expiry-token'
        // No expires_at
      })
      
      const token = await netSuiteAuth.getValidAccessToken()
      
      expect(token).toBe('no-expiry-token')
    })

    it('should throw error if no credentials found', async () => {
      mockAuthManager.getCredentials.mockResolvedValue(null)
      
      await expect(netSuiteAuth.getValidAccessToken())
        .rejects.toThrow('OAuth credentials not found')
    })
  })

  describe('revokeTokens', () => {
    it('should revoke both access and refresh tokens', async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      })
      
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await netSuiteAuth.revokeTokens()
      
      expect(global.fetch).toHaveBeenCalledTimes(2)
      
      // Check access token revocation
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/rest/auth/oauth2/v1/revoke'),
        expect.objectContaining({
          body: expect.any(URLSearchParams)
        })
      )
      
      const firstCall = (global.fetch as jest.Mock).mock.calls[0][1].body
      expect(firstCall.get('token')).toBe('access-token')
      expect(firstCall.get('token_type_hint')).toBe('access_token')
      
      // Check refresh token revocation
      const secondCall = (global.fetch as jest.Mock).mock.calls[1][1].body
      expect(secondCall.get('token')).toBe('refresh-token')
      expect(secondCall.get('token_type_hint')).toBe('refresh_token')
      
      expect(mockAuthManager.deleteCredentials).toHaveBeenCalled()
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_integration_activity', expect.objectContaining({
        p_message: 'NetSuite OAuth tokens revoked'
      }))
    })

    it('should handle revocation failures gracefully', async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      })
      
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 400, statusText: 'Bad Request' })
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
      
      await expect(netSuiteAuth.revokeTokens())
        .rejects.toThrow('Token revocation failed:')
    })

    it('should handle no credentials gracefully', async () => {
      mockAuthManager.getCredentials.mockResolvedValue(null)
      
      await expect(netSuiteAuth.revokeTokens()).resolves.toBeUndefined()
    })

    it('should handle network errors during revocation', async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        access_token: 'access-token'
      })
      
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
      
      await expect(netSuiteAuth.revokeTokens())
        .rejects.toThrow('Token revocation failed:')
    })
  })

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        access_token: 'valid-token'
      })
      
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
      
      const result = await netSuiteAuth.testConnection()
      
      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/rest/record/v1/metadata-catalog/'),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
          }
        })
      )
    })

    it('should return false for failed connection', async () => {
      mockAuthManager.getCredentials.mockResolvedValue({
        credential_type: 'oauth2',
        access_token: 'invalid-token'
      })
      
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
      
      const result = await netSuiteAuth.testConnection()
      
      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      mockAuthManager.getCredentials.mockRejectedValue(new Error('Credentials error'))
      
      const result = await netSuiteAuth.testConnection()
      
      expect(result).toBe(false)
    })
  })

  describe('static methods', () => {
    describe('generateState', () => {
      it('should generate 64 character hex string', () => {
        const state = NetSuiteAuth.generateState()
        
        expect(state).toHaveLength(64)
        expect(state).toMatch(/^[0-9a-f]+$/)
      })

      it('should generate different states each time', () => {
        const state1 = NetSuiteAuth.generateState()
        const state2 = NetSuiteAuth.generateState()
        
        expect(state1).not.toBe(state2)
      })
    })

    describe('storeOAuthState', () => {
      it('should store state with expiry', async () => {
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockResolvedValue({ data: null, error: null })
        } as any)
        
        await NetSuiteAuth.storeOAuthState('state-123', 'integration-123')
        
        expect(mockSupabase.from).toHaveBeenCalledWith('oauth_states')
        expect(mockSupabase.from().insert).toHaveBeenCalledWith({
          state: 'state-123',
          integration_id: 'integration-123',
          expires_at: expect.any(String)
        })
      })

      it('should handle storage errors', async () => {
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error', code: 'PGRST123' }
          })
        } as any)
        
        await expect(NetSuiteAuth.storeOAuthState('state', 'int-id'))
          .rejects.toThrow('Failed to store OAuth state: Database error')
      })
    })

    describe('verifyOAuthState', () => {
      it('should verify and delete valid state', async () => {
        const mockDelete = jest.fn().mockResolvedValue({ data: null, error: null })
        
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'oauth_states') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  gt: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { integration_id: 'integration-123' },
                      error: null
                    })
                  })
                })
              }),
              delete: jest.fn().mockReturnValue({
                eq: mockDelete
              })
            } as any
          }
          return {} as any
        })
        
        const result = await NetSuiteAuth.verifyOAuthState('state-123')
        
        expect(result).toBe('integration-123')
        expect(mockDelete).toHaveBeenCalledWith('state', 'state-123')
      })

      it('should return null for invalid state', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gt: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' }
                })
              })
            })
          })
        } as any)
        
        const result = await NetSuiteAuth.verifyOAuthState('invalid-state')
        
        expect(result).toBeNull()
      })

      it('should return null for expired state', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gt: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          })
        } as any)
        
        const result = await NetSuiteAuth.verifyOAuthState('expired-state')
        
        expect(result).toBeNull()
      })
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn(),
    rpc: jest.fn()
  }
}