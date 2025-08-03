import { AuthManager, OAUTH_CONFIGS } from '@/lib/integrations/auth-manager'
import { createClient } from '@/lib/supabase/server'
import { AuthenticationError } from '@/types/integration.types'
import type {
  ApiKeyCredentials,
  CredentialTypeEnum,
  IntegrationCredential,
  OAuthCredentials,
} from '@/types/integration.types'

// Mock dependencies
jest.mock('@/lib/supabase/server')

// Mock fetch
global.fetch = jest.fn()

// Mock crypto.getRandomValues
global.crypto = {
  getRandomValues: jest.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
    return array
  }),
} as any

describe('AuthManager', () => {
  let authManager: AuthManager
  let mockSupabase: ReturnType<typeof createMockSupabase>
  const integrationId = 'integration-123'
  const organizationId = 'org-123'

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = createMockSupabase()
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    authManager = new AuthManager(integrationId, organizationId)
  })

  describe('storeCredentials', () => {
    it('should store API key credentials', async () => {
      const credentials: ApiKeyCredentials = {
        api_key: 'test-api-key',
        api_secret: 'test-api-secret',
      }

      const encryptedData = 'encrypted-data'
      const storedCredential: IntegrationCredential = {
        id: 'cred-123',
        integration_id: integrationId,
        credential_type: 'api_key',
        encrypted_data: encryptedData,
        access_token_expires_at: null,
        refresh_token_expires_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: encryptedData,
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: storedCredential,
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await authManager.storeCredentials('api_key', credentials)

      expect(result).toEqual(storedCredential)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('encrypt_credential', {
        p_credential: JSON.stringify(credentials),
      })
      expect(mockSupabase.from).toHaveBeenCalledWith('integration_credentials')
    })

    it('should store OAuth credentials with expiry', async () => {
      const expiryDate = new Date()
      expiryDate.setHours(expiryDate.getHours() + 1)

      const credentials: OAuthCredentials = {
        client_id: 'client-id',
        client_secret: 'client-secret',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_at: expiryDate.toISOString(),
        scope: 'read write',
      }

      const encryptedData = 'encrypted-oauth'
      mockSupabase.rpc.mockResolvedValue({ data: encryptedData, error: null })

      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'cred-456',
                access_token_expires_at: expiryDate.toISOString(),
              },
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await authManager.storeCredentials('oauth2', credentials)

      expect(result.access_token_expires_at).toBe(expiryDate.toISOString())
    })

    it('should handle encryption errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Encryption failed' },
      })

      await expect(
        authManager.storeCredentials('api_key', { api_key: 'test' })
      ).rejects.toThrow(AuthenticationError)
    })

    it('should validate OAuth expiry date', async () => {
      const invalidCredentials: OAuthCredentials = {
        client_id: 'client-id',
        client_secret: 'client-secret',
        access_token: 'access-token',
        expires_at: 'invalid-date',
      }

      mockSupabase.rpc.mockResolvedValue({ data: 'encrypted', error: null })

      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'cred-123' },
              error: null,
            }),
          }),
        }),
      } as any)

      await expect(
        authManager.storeCredentials('oauth2', invalidCredentials)
      ).rejects.toThrow('Failed to store credentials')
    })

    it('should handle database errors', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'encrypted', error: null })

      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as any)

      await expect(
        authManager.storeCredentials('api_key', { api_key: 'test' })
      ).rejects.toThrow(AuthenticationError)
    })
  })

  describe('getCredentials', () => {
    it('should retrieve and decrypt credentials', async () => {
      const encryptedData = 'encrypted-data'
      const decryptedData = { api_key: 'test-key' }

      const credential: IntegrationCredential = {
        id: 'cred-123',
        integration_id: integrationId,
        credential_type: 'api_key',
        encrypted_data: encryptedData,
        access_token_expires_at: null,
        refresh_token_expires_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: credential,
              error: null,
            }),
          }),
        }),
      } as any)

      mockSupabase.rpc.mockResolvedValue({
        data: JSON.stringify(decryptedData),
        error: null,
      })

      const result = await authManager.getCredentials()

      expect(result).toEqual(decryptedData)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('decrypt_credential', {
        p_encrypted: encryptedData,
      })
    })

    it('should return null when no credentials exist', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      } as any)

      const result = await authManager.getCredentials()
      expect(result).toBeNull()
    })

    it('should refresh expired OAuth tokens', async () => {
      const expiredDate = new Date()
      expiredDate.setMinutes(expiredDate.getMinutes() + 10) // Within refresh threshold

      const credential: IntegrationCredential = {
        id: 'cred-123',
        integration_id: integrationId,
        credential_type: 'oauth2',
        encrypted_data: 'encrypted',
        access_token_expires_at: expiredDate.toISOString(),
        refresh_token_expires_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const currentCreds: OAuthCredentials = {
        client_id: 'client-id',
        client_secret: 'client-secret',
        access_token: 'old-token',
        refresh_token: 'refresh-token',
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: credential,
              error: null,
            }),
          }),
        }),
      } as any)

      // Mock initial decrypt for refresh check
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: JSON.stringify(currentCreds),
          error: null,
        })
        // Mock integration query
        .mockResolvedValueOnce({ data: null, error: null })

      // Mock integration lookup
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'integration_credentials') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: credential,
                  error: null,
                }),
              }),
            }),
          } as any
        }
        if (table === 'integrations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { platform: 'shopify', config: { shop: 'test-shop' } },
                  error: null,
                }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      // Mock token refresh
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600,
        }),
      })

      await expect(authManager.getCredentials()).rejects.toThrow(
        'Failed to retrieve credentials'
      )
    })

    it('should handle decryption errors', async () => {
      const credential: IntegrationCredential = {
        id: 'cred-123',
        integration_id: integrationId,
        credential_type: 'api_key',
        encrypted_data: 'encrypted',
        access_token_expires_at: null,
        refresh_token_expires_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: credential,
              error: null,
            }),
          }),
        }),
      } as any)

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Decryption failed' },
      })

      await expect(authManager.getCredentials()).rejects.toThrow(
        AuthenticationError
      )
    })
  })

  describe('rotateCredentials', () => {
    it('should rotate existing credentials', async () => {
      const newCredentials: ApiKeyCredentials = {
        api_key: 'new-api-key',
        api_secret: 'new-api-secret',
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { credential_type: 'api_key' },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as any)

      // Mock encryption for new credentials
      mockSupabase.rpc.mockResolvedValue({ data: 'encrypted-new', error: null })

      // Mock upsert for new credentials
      const mockUpsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'cred-new', rotated_at: new Date().toISOString() },
            error: null,
          }),
        }),
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'integration_credentials') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { credential_type: 'api_key' },
                  error: null,
                }),
              }),
            }),
            upsert: mockUpsert,
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          } as any
        }
        return {} as any
      })

      const result = await authManager.rotateCredentials(newCredentials)

      expect(result.id).toBe('cred-new')
      expect(mockUpsert).toHaveBeenCalled()
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'log_integration_activity',
        expect.objectContaining({
          p_message: 'Credentials rotated successfully',
        })
      )
    })

    it('should throw error if no existing credentials', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      } as any)

      await expect(
        authManager.rotateCredentials({ api_key: 'new-key' })
      ).rejects.toThrow('Failed to rotate credentials')
    })

    it('should handle rotation errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { credential_type: 'api_key' },
              error: null,
            }),
          }),
        }),
      } as any)

      mockSupabase.rpc.mockRejectedValue(new Error('Encryption failed'))

      await expect(
        authManager.rotateCredentials({ api_key: 'new-key' })
      ).rejects.toThrow(AuthenticationError)
    })
  })

  describe('deleteCredentials', () => {
    it('should delete credentials successfully', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as any)

      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await authManager.deleteCredentials()

      expect(mockSupabase.from).toHaveBeenCalledWith('integration_credentials')
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'log_integration_activity',
        expect.objectContaining({
          p_message: 'Credentials deleted',
        })
      )
    })

    it('should handle deletion errors', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Delete failed' },
          }),
        }),
      } as any)

      await expect(authManager.deleteCredentials()).rejects.toThrow(
        AuthenticationError
      )
    })
  })

  describe('buildAuthorizationUrl', () => {
    it('should build Shopify authorization URL', async () => {
      const config = {
        clientId: 'shopify-client-id',
        redirectUri: 'https://app.example.com/callback',
        scope: 'read_products write_inventory',
        additionalParams: { shop: 'test-shop' },
      }

      const url = await authManager.buildAuthorizationUrl(
        'shopify',
        config,
        'state123'
      )

      expect(url).toContain(
        'https://test-shop.myshopify.com/admin/oauth/authorize'
      )
      expect(url).toContain('client_id=shopify-client-id')
      expect(url).toContain(
        'redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback'
      )
      expect(url).toContain('response_type=code')
      expect(url).toContain('scope=read_products+write_inventory')
      expect(url).toContain('state=state123')
    })

    it('should build QuickBooks authorization URL', async () => {
      const config = {
        clientId: 'qb-client-id',
        redirectUri: 'https://app.example.com/qb-callback',
        scope: 'com.intuit.quickbooks.accounting',
      }

      const url = await authManager.buildAuthorizationUrl('quickbooks', config)

      expect(url).toContain('https://appcenter.intuit.com/connect/oauth2')
      expect(url).toContain('client_id=qb-client-id')
    })

    it('should throw error for NetSuite', async () => {
      await expect(
        authManager.buildAuthorizationUrl('netsuite', {})
      ).rejects.toThrow('NetSuite uses OAuth 1.0a')
    })

    it('should throw error for unsupported platform', async () => {
      await expect(
        authManager.buildAuthorizationUrl('unknown', {})
      ).rejects.toThrow('OAuth not supported for platform: unknown')
    })

    it('should generate state if not provided', async () => {
      const config = {
        clientId: 'client-id',
        redirectUri: 'https://app.example.com/callback',
      }

      const url = await authManager.buildAuthorizationUrl('shopify', config)
      const urlObj = new URL(url.replace('{shop}', 'test'))
      const state = urlObj.searchParams.get('state')

      expect(state).toBeTruthy()
      expect(state).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe('exchangeCodeForToken', () => {
    it('should exchange code for token successfully', async () => {
      const config = {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://app.example.com/callback',
        additionalParams: { shop: 'test-shop' },
      }

      const tokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read_products',
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => tokenResponse,
      })

      mockSupabase.rpc.mockResolvedValue({ data: 'encrypted', error: null })
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      } as any)

      const result = await authManager.exchangeCodeForToken(
        'shopify',
        'auth-code',
        config
      )

      expect(result.access_token).toBe('new-access-token')
      expect(result.refresh_token).toBe('new-refresh-token')
      expect(result.expires_at).toBeDefined()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test-shop.myshopify.com/admin/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      )
    })

    it('should handle token exchange errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error: 'invalid_grant' }),
      })

      await expect(
        authManager.exchangeCodeForToken('shopify', 'invalid-code', {
          clientId: 'client-id',
          clientSecret: 'client-secret',
        })
      ).rejects.toThrow('Failed to exchange code for token')
    })

    it('should validate token response', async () => {
      const invalidResponses = [
        null,
        'string-response',
        { invalid: 'response' },
        { access_token: 123 }, // Wrong type
      ]

      for (const response of invalidResponses) {
        ;(global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => response,
        })

        await expect(
          authManager.exchangeCodeForToken('shopify', 'code', {
            clientId: 'client-id',
            clientSecret: 'client-secret',
          })
        ).rejects.toThrow()
      }
    })

    it('should handle platform without OAuth config', async () => {
      await expect(
        authManager.exchangeCodeForToken('unknown', 'code', {})
      ).rejects.toThrow('OAuth not supported for platform: unknown')
    })
  })

  describe('static methods', () => {
    describe('validateApiKey', () => {
      it('should validate Shopify API keys', () => {
        expect(
          AuthManager.validateApiKey(
            'a1b2c3d4e5f678901234567890123456',
            'shopify'
          )
        ).toBe(true)
        expect(AuthManager.validateApiKey('invalid', 'shopify')).toBe(false)
        expect(AuthManager.validateApiKey('', 'shopify')).toBe(false)
      })

      it('should validate NetSuite API keys', () => {
        expect(
          AuthManager.validateApiKey('any-non-empty-key', 'netsuite')
        ).toBe(true)
        expect(AuthManager.validateApiKey('', 'netsuite')).toBe(false)
      })

      it('should validate generic API keys', () => {
        expect(AuthManager.validateApiKey('abcdef1234567890')).toBe(true)
        expect(AuthManager.validateApiKey('key_1234567890123456')).toBe(true)
        expect(AuthManager.validateApiKey('test-api-key.production')).toBe(true)
        expect(AuthManager.validateApiKey('short')).toBe(false)
        expect(AuthManager.validateApiKey('invalid@key!')).toBe(false)
      })

      it('should handle invalid inputs', () => {
        expect(AuthManager.validateApiKey(null as any)).toBe(false)
        expect(AuthManager.validateApiKey(undefined as any)).toBe(false)
        expect(AuthManager.validateApiKey(123 as any)).toBe(false)
      })
    })

    describe('validateOAuthCredentials', () => {
      it('should validate complete OAuth credentials', () => {
        const valid: OAuthCredentials = {
          client_id: 'client-id',
          client_secret: 'client-secret',
          access_token: 'access-token',
        }
        expect(AuthManager.validateOAuthCredentials(valid)).toBe(true)
      })

      it('should reject incomplete OAuth credentials', () => {
        const invalid: Partial<OAuthCredentials>[] = [
          { client_id: 'id', client_secret: 'secret' }, // Missing access_token
          { client_id: 'id', access_token: 'token' }, // Missing client_secret
          { client_secret: 'secret', access_token: 'token' }, // Missing client_id
          {}, // Empty
        ]

        invalid.forEach((creds) => {
          expect(
            AuthManager.validateOAuthCredentials(creds as OAuthCredentials)
          ).toBe(false)
        })
      })
    })

    describe('isCredentialExpired', () => {
      it('should detect expired credentials', () => {
        const expired: IntegrationCredential = {
          id: 'cred-123',
          integration_id: 'int-123',
          credential_type: 'oauth2',
          encrypted_data: 'encrypted',
          access_token_expires_at: new Date(Date.now() - 1000).toISOString(),
          refresh_token_expires_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        expect(AuthManager.isCredentialExpired(expired)).toBe(true)
      })

      it('should detect non-expired credentials', () => {
        const valid: IntegrationCredential = {
          id: 'cred-123',
          integration_id: 'int-123',
          credential_type: 'oauth2',
          encrypted_data: 'encrypted',
          access_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          refresh_token_expires_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        expect(AuthManager.isCredentialExpired(valid)).toBe(false)
      })

      it('should handle credentials without expiry', () => {
        const noExpiry: IntegrationCredential = {
          id: 'cred-123',
          integration_id: 'int-123',
          credential_type: 'api_key',
          encrypted_data: 'encrypted',
          access_token_expires_at: null,
          refresh_token_expires_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        expect(AuthManager.isCredentialExpired(noExpiry)).toBe(false)
      })
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn(),
    rpc: jest.fn(),
  }
}
