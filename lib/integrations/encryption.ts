// PRP-012: Encryption utilities for Integration Framework
import { createClient } from '@/lib/supabase/server'
import { AuthenticationError } from '@/types/integration.types'

// Encryption configuration
export interface EncryptionConfig {
  keyId?: string
  algorithm?: 'aes-256-gcm' | 'xchacha20poly1305'
}

const DEFAULT_CONFIG: EncryptionConfig = {
  keyId: 'app-secret-key',
  algorithm: 'xchacha20poly1305',
}

export class EncryptionService {
  private config: EncryptionConfig

  constructor(config?: Partial<EncryptionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Encrypt sensitive data using Supabase Vault
   */
  async encrypt(plaintext: string): Promise<string> {
    const supabase = createClient()
    
    try {
      if (!plaintext) {
        throw new Error('Cannot encrypt empty data')
      }

      // Use Supabase RPC function for encryption
      const { data, error } = await supabase
        .rpc('encrypt_credential', {
          p_credential: plaintext,
          p_key_id: this.config.keyId,
        })

      if (error) {
        throw new AuthenticationError('Encryption failed', error)
      }

      return data
    } catch (error) {
      throw new AuthenticationError(
        'Failed to encrypt data',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Decrypt data encrypted with encrypt()
   */
  async decrypt(ciphertext: string): Promise<string> {
    const supabase = createClient()
    
    try {
      if (!ciphertext) {
        throw new Error('Cannot decrypt empty data')
      }

      // Use Supabase RPC function for decryption
      const { data, error } = await supabase
        .rpc('decrypt_credential', {
          p_encrypted: ciphertext,
          p_key_id: this.config.keyId,
        })

      if (error) {
        throw new AuthenticationError('Decryption failed', error)
      }

      return data
    } catch (error) {
      throw new AuthenticationError(
        'Failed to decrypt data',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Encrypt an object as JSON
   */
  async encryptObject<T>(obj: T): Promise<string> {
    try {
      const json = JSON.stringify(obj)
      return await this.encrypt(json)
    } catch (error) {
      throw new AuthenticationError(
        'Failed to encrypt object',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Decrypt and parse JSON object
   */
  async decryptObject<T>(ciphertext: string): Promise<T> {
    try {
      const json = await this.decrypt(ciphertext)
      return JSON.parse(json) as T
    } catch (error) {
      throw new AuthenticationError(
        'Failed to decrypt object',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Hash sensitive data for comparison without storing plaintext
   * Uses HMAC-SHA256 for deterministic hashing
   */
  async hash(data: string, salt: string = 'default-salt'): Promise<string> {
    try {
      const encoder = new TextEncoder()
      
      // Import the salt as a key for HMAC
      const keyData = encoder.encode(salt)
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      
      // Create HMAC of the data
      const dataBuffer = encoder.encode(data)
      const signature = await crypto.subtle.sign('HMAC', key, dataBuffer)
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(signature))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      throw new AuthenticationError(
        'Failed to hash data',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Generate a cryptographically secure random string
   */
  generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Generate a secure webhook secret
   */
  generateWebhookSecret(): string {
    // Generate 32 bytes (256 bits) for strong security
    return this.generateSecureToken(32)
  }

  /**
   * Mask sensitive data for display
   */
  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) {
      return '****'
    }

    const visible = data.slice(-visibleChars)
    const masked = '*'.repeat(Math.max(4, data.length - visibleChars))
    return masked + visible
  }

  /**
   * Validate that a string is properly encrypted
   */
  isEncrypted(data: string): boolean {
    if (!data) return false

    // Check if it's base64 encoded and has proper length
    try {
      const decoded = Buffer.from(data, 'base64')
      // Encrypted data should have nonce (24 bytes) + ciphertext + tag
      return decoded.length >= 40 // Minimum reasonable length
    } catch {
      return false
    }
  }
}

// Singleton instance for convenience
export const encryption = new EncryptionService()

// Utility functions for common operations
export const encryptionUtils = {
  /**
   * Encrypt API credentials
   */
  async encryptApiKey(apiKey: string, apiSecret?: string): Promise<string> {
    const credentials = { apiKey, apiSecret }
    return encryption.encryptObject(credentials)
  },

  /**
   * Encrypt OAuth tokens
   */
  async encryptOAuthTokens(
    accessToken: string,
    refreshToken?: string,
    expiresAt?: string
  ): Promise<string> {
    const tokens = { accessToken, refreshToken, expiresAt }
    return encryption.encryptObject(tokens)
  },

  /**
   * Safely compare two encrypted values
   */
  async compareEncrypted(
    encrypted1: string,
    encrypted2: string
  ): Promise<boolean> {
    try {
      const decrypted1 = await encryption.decrypt(encrypted1)
      const decrypted2 = await encryption.decrypt(encrypted2)
      
      // Use timing-safe comparison
      if (decrypted1.length !== decrypted2.length) {
        return false
      }

      let result = 0
      for (let i = 0; i < decrypted1.length; i++) {
        result |= decrypted1.charCodeAt(i) ^ decrypted2.charCodeAt(i)
      }
      
      return result === 0
    } catch {
      return false
    }
  },

  /**
   * Generate and encrypt a new API key
   */
  async generateApiKey(prefix?: string): Promise<{
    plaintext: string
    encrypted: string
  }> {
    const key = `${prefix || 'key'}_${encryption.generateSecureToken(32)}`
    const encrypted = await encryption.encrypt(key)
    
    return { plaintext: key, encrypted }
  },

  /**
   * Validate webhook signature
   */
  async validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    try {
      // Most webhooks use HMAC-SHA256
      const encoder = new TextEncoder()
      const keyData = encoder.encode(secret)
      const messageData = encoder.encode(payload)

      // Import the key for HMAC
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )

      // Compute HMAC
      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageData
      )

      // Convert signature to hex string
      const computedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Timing-safe comparison
      if (computedSignature.length !== signature.length) {
        return false
      }

      let result = 0
      for (let i = 0; i < computedSignature.length; i++) {
        result |= computedSignature.charCodeAt(i) ^ signature.charCodeAt(i)
      }

      return result === 0
    } catch {
      return false
    }
  },
}

// Re-export for convenience
export { AuthenticationError } from '@/types/integration.types'