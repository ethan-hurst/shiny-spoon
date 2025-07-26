// PRP-012: Authentication Manager for Integration Framework
import { createClient } from '@/lib/supabase/server'
import {
  AuthenticationError,
  type IntegrationCredential,
  type CredentialTypeEnum,
  type OAuthCredentials,
  type ApiKeyCredentials,
  type BasicAuthCredentials,
  type CredentialData,
} from '@/types/integration.types'

// OAuth configuration per platform
export interface OAuthConfig {
  authorizationUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope?: string
  redirectUri?: string
  responseType?: string
  grantType?: string
  additionalParams?: Record<string, string>
}

// Platform OAuth configurations
export const OAUTH_CONFIGS: Record<string, Partial<OAuthConfig>> = {
  shopify: {
    authorizationUrl: 'https://{shop}.myshopify.com/admin/oauth/authorize',
    tokenUrl: 'https://{shop}.myshopify.com/admin/oauth/access_token',
    responseType: 'code',
    grantType: 'authorization_code',
  },
  quickbooks: {
    authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    grantType: 'authorization_code',
  },
  netsuite: {
    // NetSuite uses OAuth 1.0a, handled separately
    authorizationUrl: '',
    tokenUrl: '',
  },
}

// Token refresh configuration
interface TokenRefreshConfig {
  refreshThreshold: number // Minutes before expiry to refresh
  maxRetries: number
  retryDelay: number // Milliseconds
}

const DEFAULT_REFRESH_CONFIG: TokenRefreshConfig = {
  refreshThreshold: 15, // Refresh 15 minutes before expiry
  maxRetries: 3,
  retryDelay: 1000,
}

export class AuthManager {
  constructor(
    private integrationId: string,
    private organizationId: string
  ) {}

  // Store credentials securely
  async storeCredentials(
    credentialType: CredentialTypeEnum,
    credentials: CredentialData
  ): Promise<IntegrationCredential> {
    const supabase = createClient()
    
    try {
      // Encrypt the credentials
      const { data: encryptedData, error: encryptError } = await supabase
        .rpc('encrypt_credential', {
          p_credential: JSON.stringify(credentials),
        })

      if (encryptError) {
        throw new AuthenticationError('Failed to encrypt credentials', encryptError)
      }

      // Calculate token expiry if OAuth
      let accessTokenExpiresAt: string | null = null
      let refreshTokenExpiresAt: string | null = null

      if (credentialType === 'oauth2' && 'expires_at' in credentials) {
        const oauthCreds = credentials as OAuthCredentials
        if (oauthCreds.expires_at) {
          accessTokenExpiresAt = oauthCreds.expires_at
        }
        // Refresh tokens typically don't expire, but if they do...
        // refreshTokenExpiresAt = calculateRefreshTokenExpiry(oauthCreds)
      }

      // Store encrypted credentials
      const { data: credential, error } = await supabase
        .from('integration_credentials')
        .upsert({
          integration_id: this.integrationId,
          credential_type: credentialType,
          encrypted_data: encryptedData,
          access_token_expires_at: accessTokenExpiresAt,
          refresh_token_expires_at: refreshTokenExpiresAt,
        })
        .select()
        .single()

      if (error) {
        throw new AuthenticationError('Failed to store credentials', error)
      }

      return credential
    } catch (error) {
      throw new AuthenticationError(
        'Failed to store credentials',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  // Retrieve and decrypt credentials
  async getCredentials(): Promise<CredentialData | null> {
    const supabase = createClient()
    
    try {
      // Get encrypted credentials
      const { data: credential, error } = await supabase
        .from('integration_credentials')
        .select('*')
        .eq('integration_id', this.integrationId)
        .single()

      if (error || !credential) {
        return null
      }

      // Check if OAuth token needs refresh
      if (
        credential.credential_type === 'oauth2' &&
        credential.access_token_expires_at
      ) {
        const expiresAt = new Date(credential.access_token_expires_at)
        const refreshThreshold = new Date()
        refreshThreshold.setMinutes(
          refreshThreshold.getMinutes() + DEFAULT_REFRESH_CONFIG.refreshThreshold
        )

        if (expiresAt <= refreshThreshold) {
          // Token needs refresh
          const refreshed = await this.refreshOAuthToken(credential)
          if (refreshed) {
            return refreshed
          }
        }
      }

      // Decrypt credentials
      const { data: decryptedData, error: decryptError } = await supabase
        .rpc('decrypt_credential', {
          p_encrypted: credential.encrypted_data,
        })

      if (decryptError) {
        throw new AuthenticationError('Failed to decrypt credentials', decryptError)
      }

      return JSON.parse(decryptedData) as CredentialData
    } catch (error) {
      throw new AuthenticationError(
        'Failed to retrieve credentials',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  // Rotate credentials
  async rotateCredentials(
    newCredentials: CredentialData
  ): Promise<IntegrationCredential> {
    const supabase = createClient()
    
    try {
      // Get existing credential record
      const { data: existing } = await supabase
        .from('integration_credentials')
        .select('credential_type')
        .eq('integration_id', this.integrationId)
        .single()

      if (!existing) {
        throw new AuthenticationError('No existing credentials to rotate')
      }

      // Store new credentials
      const rotated = await this.storeCredentials(
        existing.credential_type as CredentialTypeEnum,
        newCredentials
      )

      // Update rotation timestamp
      await supabase
        .from('integration_credentials')
        .update({ rotated_at: new Date().toISOString() })
        .eq('id', rotated.id)

      // Log rotation event
      await supabase.rpc('log_integration_activity', {
        p_integration_id: this.integrationId,
        p_organization_id: this.organizationId,
        p_log_type: 'auth',
        p_severity: 'info',
        p_message: 'Credentials rotated successfully',
      })

      return rotated
    } catch (error) {
      throw new AuthenticationError(
        'Failed to rotate credentials',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  // Delete credentials
  async deleteCredentials(): Promise<void> {
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('integration_credentials')
        .delete()
        .eq('integration_id', this.integrationId)

      if (error) {
        throw new AuthenticationError('Failed to delete credentials', error)
      }

      // Log deletion
      await supabase.rpc('log_integration_activity', {
        p_integration_id: this.integrationId,
        p_organization_id: this.organizationId,
        p_log_type: 'auth',
        p_severity: 'warning',
        p_message: 'Credentials deleted',
      })
    } catch (error) {
      throw new AuthenticationError(
        'Failed to delete credentials',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  // OAuth-specific methods
  async buildAuthorizationUrl(
    platform: string,
    config: Partial<OAuthConfig>,
    state?: string
  ): Promise<string> {
    const platformConfig = OAUTH_CONFIGS[platform]
    if (!platformConfig?.authorizationUrl) {
      throw new AuthenticationError(`OAuth not supported for platform: ${platform}`)
    }

    const mergedConfig = { ...platformConfig, ...config }
    const params = new URLSearchParams({
      client_id: mergedConfig.clientId!,
      redirect_uri: mergedConfig.redirectUri || '',
      response_type: mergedConfig.responseType || 'code',
      scope: mergedConfig.scope || '',
      state: state || this.generateState(),
      ...mergedConfig.additionalParams,
    })

    // Handle platform-specific URL patterns
    let authUrl = mergedConfig.authorizationUrl
    if (platform === 'shopify' && config.additionalParams?.shop) {
      authUrl = authUrl.replace('{shop}', config.additionalParams.shop)
    }

    return `${authUrl}?${params.toString()}`
  }

  async exchangeCodeForToken(
    platform: string,
    code: string,
    config: Partial<OAuthConfig>
  ): Promise<OAuthCredentials> {
    const platformConfig = OAUTH_CONFIGS[platform]
    if (!platformConfig?.tokenUrl) {
      throw new AuthenticationError(`OAuth not supported for platform: ${platform}`)
    }

    const mergedConfig = { ...platformConfig, ...config }
    
    try {
      // Build token request
      const tokenData = {
        grant_type: mergedConfig.grantType || 'authorization_code',
        code,
        client_id: mergedConfig.clientId!,
        client_secret: mergedConfig.clientSecret!,
        redirect_uri: mergedConfig.redirectUri || '',
        ...mergedConfig.additionalParams,
      }

      // Handle platform-specific URL patterns
      let tokenUrl = mergedConfig.tokenUrl
      if (platform === 'shopify' && config.additionalParams?.shop) {
        tokenUrl = tokenUrl.replace('{shop}', config.additionalParams.shop)
      }

      // Exchange code for token
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenData),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }))
        throw new AuthenticationError('Token exchange failed', error)
      }

      const tokenResponse = await response.json()

      // Calculate token expiry
      let expiresAt: string | undefined
      if (tokenResponse.expires_in) {
        const expiry = new Date()
        expiry.setSeconds(expiry.getSeconds() + tokenResponse.expires_in)
        expiresAt = expiry.toISOString()
      }

      // Build OAuth credentials
      const credentials: OAuthCredentials = {
        client_id: mergedConfig.clientId!,
        client_secret: mergedConfig.clientSecret!,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        token_type: tokenResponse.token_type || 'Bearer',
        expires_at: expiresAt,
        scope: tokenResponse.scope || mergedConfig.scope,
      }

      // Store the credentials
      await this.storeCredentials('oauth2', credentials)

      return credentials
    } catch (error) {
      throw new AuthenticationError(
        'Failed to exchange code for token',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  private async refreshOAuthToken(
    credential: IntegrationCredential
  ): Promise<OAuthCredentials | null> {
    const supabase = createClient()
    
    try {
      // Decrypt current credentials
      const { data: decryptedData } = await supabase
        .rpc('decrypt_credential', {
          p_encrypted: credential.encrypted_data,
        })

      const currentCreds = JSON.parse(decryptedData) as OAuthCredentials

      if (!currentCreds.refresh_token) {
        return null // Can't refresh without refresh token
      }

      // Get platform config
      const { data: integration } = await supabase
        .from('integrations')
        .select('platform, config')
        .eq('id', this.integrationId)
        .single()

      if (!integration) {
        return null
      }

      const platformConfig = OAUTH_CONFIGS[integration.platform]
      if (!platformConfig?.tokenUrl) {
        return null
      }

      // Refresh the token
      const tokenData = {
        grant_type: 'refresh_token',
        refresh_token: currentCreds.refresh_token,
        client_id: currentCreds.client_id,
        client_secret: currentCreds.client_secret,
      }

      let tokenUrl = platformConfig.tokenUrl
      if (integration.platform === 'shopify' && integration.config?.shop) {
        tokenUrl = tokenUrl.replace('{shop}', integration.config.shop)
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenData),
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`)
      }

      const tokenResponse = await response.json()

      // Calculate new expiry
      let expiresAt: string | undefined
      if (tokenResponse.expires_in) {
        const expiry = new Date()
        expiry.setSeconds(expiry.getSeconds() + tokenResponse.expires_in)
        expiresAt = expiry.toISOString()
      }

      // Update credentials
      const refreshedCreds: OAuthCredentials = {
        ...currentCreds,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token || currentCreds.refresh_token,
        expires_at: expiresAt,
      }

      // Store refreshed credentials
      await this.storeCredentials('oauth2', refreshedCreds)

      // Log refresh event
      await supabase.rpc('log_integration_activity', {
        p_integration_id: this.integrationId,
        p_organization_id: this.organizationId,
        p_log_type: 'auth',
        p_severity: 'info',
        p_message: 'OAuth token refreshed successfully',
      })

      return refreshedCreds
    } catch (error) {
      // Log refresh failure
      const supabase = createClient()
      await supabase.rpc('log_integration_activity', {
        p_integration_id: this.integrationId,
        p_organization_id: this.organizationId,
        p_log_type: 'auth',
        p_severity: 'error',
        p_message: 'OAuth token refresh failed',
        p_details: { error: error instanceof Error ? error.message : String(error) },
      })

      return null
    }
  }

  // Generate secure state parameter for OAuth
  private generateState(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // Validate API key format
  static validateApiKey(key: string, platform?: string): boolean {
    if (!key || typeof key !== 'string') return false

    // Platform-specific validation
    switch (platform) {
      case 'shopify':
        // Shopify private app API keys are usually 32 characters
        return /^[a-f0-9]{32}$/.test(key)
      
      case 'netsuite':
        // NetSuite uses consumer key/secret pairs
        return key.length > 0
      
      default:
        // Generic validation - at least 16 characters and valid characters
        // Allow alphanumeric, dashes, underscores, and dots (common in API keys)
        return key.length >= 16 && /^[a-zA-Z0-9_\-\.]+$/.test(key)
    }
  }

  // Validate OAuth credentials
  static validateOAuthCredentials(creds: OAuthCredentials): boolean {
    return !!(
      creds.client_id &&
      creds.client_secret &&
      creds.access_token
    )
  }

  // Check if credentials are expired
  static isCredentialExpired(credential: IntegrationCredential): boolean {
    if (!credential.access_token_expires_at) return false

    const expiresAt = new Date(credential.access_token_expires_at)
    return expiresAt <= new Date()
  }
}