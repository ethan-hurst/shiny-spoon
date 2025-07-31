import { EncryptionService, encryptionUtils } from '@/lib/integrations/encryption'
import { createClient } from '@/lib/supabase/server'
import { AuthenticationError } from '@/types/integration.types'

// Mock dependencies
jest.mock('@/lib/supabase/server')

// Mock crypto module
jest.mock('crypto', () => ({
  createHmac: jest.fn(),
  createDecipheriv: jest.fn(),
  randomBytes: jest.fn()
}))

describe('EncryptionService', () => {
  let encryptionService: EncryptionService
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = createMockSupabase()
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    encryptionService = new EncryptionService()
  })

  describe('constructor', () => {
    it('should create with default config', () => {
      const service = new EncryptionService()
      expect(service).toBeInstanceOf(EncryptionService)
    })

    it('should merge custom config', () => {
      const service = new EncryptionService({
        keyId: 'custom-key',
        algorithm: 'aes-256-gcm'
      })
      expect(service).toBeInstanceOf(EncryptionService)
    })
  })

  describe('encrypt', () => {
    it('should encrypt plaintext successfully', async () => {
      const plaintext = 'sensitive-data'
      const encrypted = 'encrypted-base64-data'
      
      mockSupabase.rpc.mockResolvedValue({
        data: encrypted,
        error: null
      })

      const result = await encryptionService.encrypt(plaintext)
      
      expect(result).toBe(encrypted)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('encrypt_credential', {
        p_credential: plaintext,
        p_key_id: 'app-secret-key'
      })
    })

    it('should throw error for empty plaintext', async () => {
      await expect(encryptionService.encrypt('')).rejects.toThrow(
        'Failed to encrypt data'
      )
    })

    it('should handle encryption errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Encryption failed' }
      })

      await expect(encryptionService.encrypt('test')).rejects.toThrow(
        AuthenticationError
      )
    })

    it('should handle RPC exceptions', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Network error'))

      await expect(encryptionService.encrypt('test')).rejects.toThrow(
        AuthenticationError
      )
    })
  })

  describe('decrypt', () => {
    it('should decrypt ciphertext successfully', async () => {
      const ciphertext = 'encrypted-base64-data'
      const plaintext = 'sensitive-data'
      
      mockSupabase.rpc.mockResolvedValue({
        data: plaintext,
        error: null
      })

      const result = await encryptionService.decrypt(ciphertext)
      
      expect(result).toBe(plaintext)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('decrypt_credential', {
        p_encrypted: ciphertext,
        p_key_id: 'app-secret-key'
      })
    })

    it('should throw error for empty ciphertext', async () => {
      await expect(encryptionService.decrypt('')).rejects.toThrow(
        'Failed to decrypt data'
      )
    })

    it('should handle decryption errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Decryption failed' }
      })

      await expect(encryptionService.decrypt('invalid')).rejects.toThrow(
        AuthenticationError
      )
    })
  })

  describe('encryptObject', () => {
    it('should encrypt object as JSON', async () => {
      const obj = { apiKey: 'test-key', apiSecret: 'test-secret' }
      const encrypted = 'encrypted-json'
      
      mockSupabase.rpc.mockResolvedValue({
        data: encrypted,
        error: null
      })

      const result = await encryptionService.encryptObject(obj)
      
      expect(result).toBe(encrypted)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('encrypt_credential', {
        p_credential: JSON.stringify(obj),
        p_key_id: 'app-secret-key'
      })
    })

    it('should handle complex objects', async () => {
      const complexObj = {
        nested: { value: 123 },
        array: [1, 2, 3],
        boolean: true,
        null: null
      }
      
      mockSupabase.rpc.mockResolvedValue({
        data: 'encrypted',
        error: null
      })

      await encryptionService.encryptObject(complexObj)
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('encrypt_credential', {
        p_credential: JSON.stringify(complexObj),
        p_key_id: 'app-secret-key'
      })
    })

    it('should handle encryption errors', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Encryption failed'))

      await expect(
        encryptionService.encryptObject({ test: 'data' })
      ).rejects.toThrow(AuthenticationError)
    })
  })

  describe('decryptObject', () => {
    it('should decrypt and parse JSON object', async () => {
      const obj = { apiKey: 'test-key', apiSecret: 'test-secret' }
      const ciphertext = 'encrypted-json'
      
      mockSupabase.rpc.mockResolvedValue({
        data: JSON.stringify(obj),
        error: null
      })

      const result = await encryptionService.decryptObject<typeof obj>(ciphertext)
      
      expect(result).toEqual(obj)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('decrypt_credential', {
        p_encrypted: ciphertext,
        p_key_id: 'app-secret-key'
      })
    })

    it('should handle invalid JSON after decryption', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'invalid-json',
        error: null
      })

      await expect(
        encryptionService.decryptObject('encrypted')
      ).rejects.toThrow(AuthenticationError)
    })
  })

  describe('hash', () => {
    it('should hash data with salt', async () => {
      const data = 'password123'
      const salt = 'random-salt'
      
      console.log('Global crypto available:', !!global.crypto)
      console.log('Global crypto.subtle available:', !!global.crypto?.subtle)
      console.log('Global crypto.subtle.importKey available:', !!global.crypto?.subtle?.importKey)
      
      const result = await encryptionService.hash(data, salt)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      // Use global crypto mock from jest.setup.js
      expect(global.crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      expect(global.crypto.subtle.sign).toHaveBeenCalledWith(
        'HMAC',
        expect.any(Object),
        expect.any(Uint8Array)
      )
    })

    it('should produce consistent hashes for same input', async () => {
      const data = 'password123'
      const salt = 'random-salt'

      const hash1 = await encryptionService.hash(data, salt)
      const hash2 = await encryptionService.hash(data, salt)
      
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different salts', async () => {
      const data = 'password123'

      const hash1 = await encryptionService.hash(data, 'salt1')
      const hash2 = await encryptionService.hash(data, 'salt2')
      
      expect(hash1).not.toBe(hash2)
    })

    it('should handle hashing errors', async () => {
      (global.crypto.subtle.importKey as jest.Mock).mockRejectedValue(new Error('Import failed'))

      await expect(
        encryptionService.hash('data', 'salt')
      ).rejects.toThrow(AuthenticationError)
    })
  })

  describe('generateSecureToken', () => {
    it('should generate token with default length', () => {
      const token = encryptionService.generateSecureToken()
      
      expect(token).toHaveLength(64) // 32 bytes * 2 chars per byte
      expect(token).toMatch(/^[0-9a-f]+$/)
    })

    it('should generate token with custom length', () => {
      const token = encryptionService.generateSecureToken(16)
      
      expect(token).toHaveLength(32) // 16 bytes * 2 chars per byte
      expect(token).toMatch(/^[0-9a-f]+$/)
    })

    it('should generate different tokens each time', () => {
      const token1 = encryptionService.generateSecureToken()
      const token2 = encryptionService.generateSecureToken()
      
      expect(token1).not.toBe(token2)
    })
  })

  describe('generateWebhookSecret', () => {
    it('should generate 256-bit webhook secret', () => {
      const secret = encryptionService.generateWebhookSecret()
      
      expect(secret).toHaveLength(64) // 32 bytes * 2 chars per byte
      expect(secret).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe('maskSensitiveData', () => {
    it('should mask data with visible chars at end', () => {
      expect(encryptionService.maskSensitiveData('1234567890')).toBe('******7890')
      expect(encryptionService.maskSensitiveData('api_key_secret')).toBe('**********cret')
    })

    it('should use custom visible chars', () => {
      expect(encryptionService.maskSensitiveData('1234567890', 2)).toBe('********90')
      expect(encryptionService.maskSensitiveData('1234567890', 6)).toBe('****567890')
    })

    it('should handle short strings', () => {
      expect(encryptionService.maskSensitiveData('123')).toBe('****')
      expect(encryptionService.maskSensitiveData('1234')).toBe('****')
      expect(encryptionService.maskSensitiveData('')).toBe('****')
    })

    it('should handle null/undefined', () => {
      expect(encryptionService.maskSensitiveData(null as any)).toBe('****')
      expect(encryptionService.maskSensitiveData(undefined as any)).toBe('****')
    })
  })

  describe('isEncrypted', () => {
    it('should validate properly encrypted data', () => {
      // Base64 encoded data with sufficient length
      const validEncrypted = Buffer.from(new Uint8Array(50)).toString('base64')
      expect(encryptionService.isEncrypted(validEncrypted)).toBe(true)
    })

    it('should reject non-encrypted data', () => {
      expect(encryptionService.isEncrypted('plaintext')).toBe(false)
      expect(encryptionService.isEncrypted('short')).toBe(false)
      expect(encryptionService.isEncrypted('')).toBe(false)
      expect(encryptionService.isEncrypted(null as any)).toBe(false)
    })

    it('should reject invalid base64', () => {
      expect(encryptionService.isEncrypted('not!valid@base64')).toBe(false)
    })

    it('should reject too short encrypted data', () => {
      const shortData = Buffer.from(new Uint8Array(20)).toString('base64')
      expect(encryptionService.isEncrypted(shortData)).toBe(false)
    })
  })
})

describe('encryptionUtils', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = createMockSupabase()
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('encryptApiKey', () => {
    it('should encrypt API key and secret', async () => {
      const encrypted = 'encrypted-credentials'
      mockSupabase.rpc.mockResolvedValue({
        data: encrypted,
        error: null
      })

      const result = await encryptionUtils.encryptApiKey('key123', 'secret456')
      
      expect(result).toBe(encrypted)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('encrypt_credential', {
        p_credential: JSON.stringify({ apiKey: 'key123', apiSecret: 'secret456' }),
        p_key_id: 'app-secret-key'
      })
    })

    it('should encrypt API key without secret', async () => {
      const encrypted = 'encrypted-key-only'
      mockSupabase.rpc.mockResolvedValue({
        data: encrypted,
        error: null
      })

      const result = await encryptionUtils.encryptApiKey('key123')
      
      expect(result).toBe(encrypted)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('encrypt_credential', {
        p_credential: JSON.stringify({ apiKey: 'key123', apiSecret: undefined }),
        p_key_id: 'app-secret-key'
      })
    })
  })

  describe('encryptOAuthTokens', () => {
    it('should encrypt OAuth tokens', async () => {
      const encrypted = 'encrypted-tokens'
      mockSupabase.rpc.mockResolvedValue({
        data: encrypted,
        error: null
      })

      const result = await encryptionUtils.encryptOAuthTokens(
        'access123',
        'refresh456',
        '2024-12-31'
      )
      
      expect(result).toBe(encrypted)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('encrypt_credential', {
        p_credential: JSON.stringify({
          accessToken: 'access123',
          refreshToken: 'refresh456',
          expiresAt: '2024-12-31'
        }),
        p_key_id: 'app-secret-key'
      })
    })

    it('should encrypt access token only', async () => {
      const encrypted = 'encrypted-access-only'
      mockSupabase.rpc.mockResolvedValue({
        data: encrypted,
        error: null
      })

      const result = await encryptionUtils.encryptOAuthTokens('access123')
      
      expect(result).toBe(encrypted)
    })
  })

  describe('compareEncrypted', () => {
    it('should return true for identical encrypted values', async () => {
      const result = await encryptionUtils.compareEncrypted(
        'same-encrypted',
        'same-encrypted'
      )
      
      expect(result).toBe(true)
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('should compare decrypted values using timing-safe comparison', async () => {
      const encrypted1 = 'encrypted1'
      const encrypted2 = 'encrypted2'
      
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: 'same-value', error: null })
        .mockResolvedValueOnce({ data: 'same-value', error: null })

      const mockHash = new Uint8Array([1, 2, 3, 4])
      (global.crypto.subtle.digest as jest.Mock).mockResolvedValue(mockHash.buffer)

      const result = await encryptionUtils.compareEncrypted(encrypted1, encrypted2)
      
      expect(result).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2)
      expect(global.crypto.subtle.digest).toHaveBeenCalledTimes(2)
    })

    it('should return false for different decrypted values', async () => {
      const encrypted1 = 'encrypted1'
      const encrypted2 = 'encrypted2'
      
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: 'value1', error: null })
        .mockResolvedValueOnce({ data: 'value2', error: null })

      (global.crypto.subtle.digest as jest.Mock)
        .mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4]).buffer)
        .mockResolvedValueOnce(new Uint8Array([5, 6, 7, 8]).buffer)

      const result = await encryptionUtils.compareEncrypted(encrypted1, encrypted2)
      
      expect(result).toBe(false)
    })

    it('should return false on decryption error', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Decryption failed'))

      const result = await encryptionUtils.compareEncrypted('enc1', 'enc2')
      
      expect(result).toBe(false)
    })
  })

  describe('generateApiKey', () => {
    it('should generate and encrypt API key with prefix', async () => {
      const encrypted = 'encrypted-new-key'
      mockSupabase.rpc.mockResolvedValue({
        data: encrypted,
        error: null
      })

      const result = await encryptionUtils.generateApiKey('sk')
      
      expect(result.plaintext).toMatch(/^sk_[0-9a-f]{64}$/)
      expect(result.encrypted).toBe(encrypted)
    })

    it('should use default prefix', async () => {
      const encrypted = 'encrypted-default-key'
      mockSupabase.rpc.mockResolvedValue({
        data: encrypted,
        error: null
      })

      const result = await encryptionUtils.generateApiKey()
      
      expect(result.plaintext).toMatch(/^key_[0-9a-f]{64}$/)
      expect(result.encrypted).toBe(encrypted)
    })
  })

  describe('validateWebhookSignature', () => {
    it('should validate correct webhook signature', async () => {
      const payload = '{"event":"test"}'
      const secret = 'webhook-secret'
      
      const mockKey = {}
      (global.crypto.subtle.importKey as jest.Mock).mockResolvedValue(mockKey)
      
      // Create a consistent signature
      const signatureBytes = new Uint8Array([1, 2, 3, 4])
      (global.crypto.subtle.sign as jest.Mock).mockResolvedValue(signatureBytes.buffer)
      
      const signature = '01020304'

      const result = await encryptionUtils.validateWebhookSignature(
        payload,
        signature,
        secret
      )
      
      expect(result).toBe(true)
      expect(global.crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
    })

    it('should reject incorrect signature', async () => {
      const payload = '{"event":"test"}'
      const secret = 'webhook-secret'
      
      (global.crypto.subtle.importKey as jest.Mock).mockResolvedValue({})
      (global.crypto.subtle.sign as jest.Mock).mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
      
      const wrongSignature = 'deadbeef'

      const result = await encryptionUtils.validateWebhookSignature(
        payload,
        wrongSignature,
        secret
      )
      
      expect(result).toBe(false)
    })

    it('should handle validation errors', async () => {
      (global.crypto.subtle.importKey as jest.Mock).mockRejectedValue(new Error('Import failed'))

      const result = await encryptionUtils.validateWebhookSignature(
        'payload',
        'signature',
        'secret'
      )
      
      expect(result).toBe(false)
    })
  })
})

describe('singleton instance', () => {
  it('should export singleton encryption instance', () => {
    expect(encryption).toBeInstanceOf(EncryptionService)
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    rpc: jest.fn()
  }
}