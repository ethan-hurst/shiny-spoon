// PRP-013: NetSuite OAuth 2.0 Authentication
import { z } from 'zod'
import { AuthManager } from '@/lib/integrations/auth-manager'
import { createClient } from '@/lib/supabase/server'
import {
  AuthenticationError,
  type OAuthCredentials,
} from '@/types/integration.types'
import type {
  NetSuiteIntegrationConfig,
  NetSuiteTokenResponse,
} from '@/types/netsuite.types'

const tokenResponseSchema = z.object({
  access_token: z.string().min(1, 'Access token cannot be empty'),
  refresh_token: z.string().min(1, 'Refresh token cannot be empty'),
  expires_in: z.number(),
  token_type: z.string(),
  scope: z.string().optional(),
})

export class NetSuiteAuth {
  private authManager: AuthManager
  private clientId: string = ''
  private clientSecret: string = ''
  private accountId: string
  private datacenterUrl: string
  private redirectUri: string

  constructor(
    private integrationId: string,
    private organizationId: string,
    private config: NetSuiteIntegrationConfig
  ) {
    this.authManager = new AuthManager(integrationId, organizationId)
    this.accountId = config.account_id
    this.datacenterUrl = config.datacenter_url
    this.redirectUri = `${process.env.NEXT_PUBLIC_URL}/integrations/netsuite/callback`
  }

  /**
   * Initialize auth with credentials
   */
  async initialize(): Promise<void> {
    try {
      const credentials = await this.authManager.getCredentials()
      if (!credentials || credentials.credential_type !== 'oauth2') {
        throw new AuthenticationError('OAuth credentials not found')
      }

      const oauthCreds = credentials as OAuthCredentials
      this.clientId = oauthCreds.client_id
      this.clientSecret = oauthCreds.client_secret
    } catch (error) {
      throw new AuthenticationError(
        'Failed to initialize NetSuite auth',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'rest_webservices',
      state,
    })

    return `https://${this.accountId}.app.netsuite.com/app/login/oauth2/authorize.nl?${params}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<NetSuiteTokenResponse> {
    try {
      const tokenUrl = `https://${this.accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
        }),
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: response.statusText }))
        throw new AuthenticationError(
          `Token exchange failed: ${response.status}`,
          error
        )
      }

      const tokenData = await response.json()
      const validated = tokenResponseSchema.parse(tokenData)

      // Calculate token expiry
      const expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + validated.expires_in)

      // Store tokens securely
      const credentials: OAuthCredentials = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        access_token: validated.access_token,
        refresh_token: validated.refresh_token,
        token_type: validated.token_type || 'Bearer',
        expires_at: expiresAt.toISOString(),
        scope: validated.scope || 'rest_webservices',
      }

      await this.authManager.storeCredentials('oauth2', credentials)

      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AuthenticationError(
          'Invalid token response format',
          error.errors
        )
      }
      throw new AuthenticationError(
        'Failed to exchange code for tokens',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<void> {
    try {
      const credentials = await this.authManager.getCredentials()
      if (!credentials || credentials.credential_type !== 'oauth2') {
        throw new AuthenticationError('OAuth credentials not found')
      }

      const oauthCreds = credentials as OAuthCredentials
      if (!oauthCreds.refresh_token) {
        throw new AuthenticationError('Refresh token not available')
      }

      const tokenUrl = `https://${this.accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: oauthCreds.refresh_token,
        }),
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: response.statusText }))
        throw new AuthenticationError(
          `Token refresh failed: ${response.status}`,
          error
        )
      }

      const tokenData = await response.json()
      const validated = tokenResponseSchema.parse(tokenData)

      // Calculate new token expiry
      const expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + validated.expires_in)

      // Update stored tokens
      const updatedCredentials: OAuthCredentials = {
        ...oauthCreds,
        access_token: validated.access_token,
        refresh_token: validated.refresh_token || oauthCreds.refresh_token,
        expires_at: expiresAt.toISOString(),
      }

      await this.authManager.storeCredentials('oauth2', updatedCredentials)

      // Log successful refresh
      const supabase = createClient()
      await supabase.rpc('log_integration_activity', {
        p_integration_id: this.integrationId,
        p_organization_id: this.organizationId,
        p_log_type: 'auth',
        p_severity: 'info',
        p_message: 'NetSuite OAuth token refreshed successfully',
      })
    } catch (error) {
      // Log refresh failure
      const supabase = createClient()
      await supabase.rpc('log_integration_activity', {
        p_integration_id: this.integrationId,
        p_organization_id: this.organizationId,
        p_log_type: 'auth',
        p_severity: 'error',
        p_message: 'NetSuite OAuth token refresh failed',
        p_details: {
          error: error instanceof Error ? error.message : String(error),
        },
      })

      throw error
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string> {
    try {
      const credentials = await this.authManager.getCredentials()
      if (!credentials || credentials.credential_type !== 'oauth2') {
        throw new AuthenticationError('OAuth credentials not found')
      }

      const oauthCreds = credentials as OAuthCredentials

      // Check if token needs refresh (5 minutes before expiry)
      if (oauthCreds.expires_at) {
        const expiresAt = new Date(oauthCreds.expires_at)
        const now = new Date()
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

        if (expiresAt <= fiveMinutesFromNow) {
          await this.refreshAccessToken()
          // Get refreshed credentials
          const refreshedCreds =
            (await this.authManager.getCredentials()) as OAuthCredentials
          return refreshedCreds.access_token
        }
      }

      return oauthCreds.access_token
    } catch (error) {
      throw new AuthenticationError(
        'Failed to get valid access token',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Revoke OAuth tokens
   */
  async revokeTokens(): Promise<void> {
    try {
      const credentials = await this.authManager.getCredentials()
      if (!credentials || credentials.credential_type !== 'oauth2') {
        return // No tokens to revoke
      }

      const oauthCreds = credentials as OAuthCredentials
      const revokeUrl = `https://${this.accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/revoke`

      // Track revocation failures
      const revocationErrors: string[] = []

      // Attempt to revoke access token
      try {
        const accessTokenResponse = await fetch(revokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: oauthCreds.access_token,
            token_type_hint: 'access_token',
          }),
        })

        if (!accessTokenResponse.ok) {
          const errorMsg = `Failed to revoke access token: ${accessTokenResponse.status} ${accessTokenResponse.statusText}`
          console.error(errorMsg, {
            status: accessTokenResponse.status,
            statusText: accessTokenResponse.statusText,
          })
          revocationErrors.push(errorMsg)
        }
      } catch (error) {
        const errorMsg = `Access token revocation error: ${error instanceof Error ? error.message : String(error)}`
        console.error(errorMsg)
        revocationErrors.push(errorMsg)
      }

      // Attempt to revoke refresh token if available
      if (oauthCreds.refresh_token) {
        try {
          const refreshTokenResponse = await fetch(revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              token: oauthCreds.refresh_token,
              token_type_hint: 'refresh_token',
            }),
          })

          if (!refreshTokenResponse.ok) {
            const errorMsg = `Failed to revoke refresh token: ${refreshTokenResponse.status} ${refreshTokenResponse.statusText}`
            console.error(errorMsg, {
              status: refreshTokenResponse.status,
              statusText: refreshTokenResponse.statusText,
            })
            revocationErrors.push(errorMsg)
          }
        } catch (error) {
          const errorMsg = `Refresh token revocation error: ${error instanceof Error ? error.message : String(error)}`
          console.error(errorMsg)
          revocationErrors.push(errorMsg)
        }
      }

      // If any revocation failed, throw a combined error
      if (revocationErrors.length > 0) {
        throw new Error(
          `Token revocation failed: ${revocationErrors.join('; ')}`
        )
      }

      // Delete stored credentials
      await this.authManager.deleteCredentials()

      // Log revocation
      const supabase = createClient()
      await supabase.rpc('log_integration_activity', {
        p_integration_id: this.integrationId,
        p_organization_id: this.organizationId,
        p_log_type: 'auth',
        p_severity: 'info',
        p_message: 'NetSuite OAuth tokens revoked',
      })
    } catch (error) {
      throw new AuthenticationError(
        'Failed to revoke tokens',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Test OAuth connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const token = await this.getValidAccessToken()

      // Make a simple API call to test the connection
      const testUrl = `https://${this.accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/metadata-catalog/`

      const response = await fetch(testUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Generate secure state parameter for OAuth
   */
  static generateState(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    )
  }

  /**
   * Store OAuth state for verification
   */
  static async storeOAuthState(
    state: string,
    integrationId: string
  ): Promise<void> {
    const supabase = createClient()

    // Store state with 10 minute expiry
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)

    const { error } = await supabase.from('oauth_states').insert({
      state,
      integration_id: integrationId,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      console.error('Failed to store OAuth state:', {
        error: error.message,
        code: error.code,
        integrationId,
      })
      throw new Error(`Failed to store OAuth state: ${error.message}`)
    }
  }

  /**
   * Verify OAuth state parameter
   */
  static async verifyOAuthState(state: string): Promise<string | null> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('oauth_states')
      .select('integration_id')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      return null
    }

    // Delete used state
    await supabase.from('oauth_states').delete().eq('state', state)

    return data.integration_id
  }
}
