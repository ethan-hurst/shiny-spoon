/**
 * API key configuration constants
 */

export const API_KEY_CONFIG = {
  PREFIX: {
    LIVE: 'sk_live_',
    TEST: 'sk_test_',
  },
  DISPLAY_PREFIX: 'ts_', // Display prefix for truncated keys
  KEY_LENGTH: 32, // Length in bytes before encoding
  HASH_ALGORITHM: 'sha256',
  PREFIX_DISPLAY_LENGTH: 12, // How many characters to show in the UI (e.g., "ts_abc123...")
} as const

export const API_KEY_SCOPES = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
} as const

export type ApiKeyScope = (typeof API_KEY_SCOPES)[keyof typeof API_KEY_SCOPES]

export const API_KEY_MESSAGES = {
  CREATED: 'API key created successfully',
  REVOKED: 'API key revoked successfully',
  REGENERATED: 'API key regenerated successfully',
  COPY_SUCCESS: 'API key copied to clipboard',
  COPY_WARNING:
    "Make sure to copy your API key now. You won't be able to see it again!",
  REVOKE_WARNING:
    'This action cannot be undone. The API key will be permanently revoked.',
} as const
