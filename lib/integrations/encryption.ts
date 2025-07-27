// PRP-012: Encryption utilities for Integration Framework
import { createClient } from '@/lib/supabase/server'
import { AuthenticationError } from '@/types/integration.types'

/**
 * Performs a constant-time comparison of two Uint8Arrays to prevent timing attacks.
 *
 * Compares both arrays up to the length of the longer array, padding shorter arrays with zeros, and incorporates length differences into the result to ensure timing safety.
 *
 * @returns True if the arrays are equal in both length and content; otherwise, false.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  // Always compare up to the maximum length to avoid timing differences
  const maxLength = Math.max(a.length, b.length)
  let result = a.length ^ b.length // Include length difference in result
  
  for (let i = 0; i < maxLength; i++) {
    // Use 0 as default for out-of-bounds indices
    const aVal = i < a.length ? a[i] : 0
    const bVal = i < b.length ? b[i] : 0
    result |= aVal ^ bVal
  }
  
  return result === 0
}

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
  async hash(data: string, salt: string): Promise<string> {
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
      // Use atob to decode base64, then convert to byte array
      const binaryString = atob(data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      // Encrypted data should have nonce (24 bytes) + ciphertext + tag
      return bytes.length >= 40 // Minimum reasonable length
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
      // First check if the encrypted strings are identical
      if (encrypted1 === encrypted2) {
        return true
      }

      // Decrypt both values
      const decrypted1 = await encryption.decrypt(encrypted1)
      const decrypted2 = await encryption.decrypt(encrypted2)
      
      // Convert strings to Uint8Array for Web Crypto API
      const encoder = new TextEncoder()
      const data1 = encoder.encode(decrypted1)
      const data2 = encoder.encode(decrypted2)
      
      // Compute SHA-256 hashes using Web Crypto API
      const [hashBuffer1, hashBuffer2] = await Promise.all([
        crypto.subtle.digest('SHA-256', data1),
        crypto.subtle.digest('SHA-256', data2)
      ])
      
      // Convert ArrayBuffers to Uint8Arrays for comparison
      const hash1 = new Uint8Array(hashBuffer1)
      const hash2 = new Uint8Array(hashBuffer2)
      
      // Timing-safe comparison compatible with Web Crypto API
      return timingSafeEqual(hash1, hash2)
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
      const computedSignatureArray = new Uint8Array(signatureBuffer)
      const computedSignature = Array.from(computedSignatureArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Convert both signatures to Uint8Array for byte-level comparison
      const textEncoder = new TextEncoder()
      const computedBytes = textEncoder.encode(computedSignature)
      const signatureBytes = textEncoder.encode(signature)

      // Use the timing-safe comparison function
      return timingSafeEqual(computedBytes, signatureBytes)
    } catch {
      return false
    }
  },
}

// Re-export for convenience
export { AuthenticationError } from '@/types/integration.types'