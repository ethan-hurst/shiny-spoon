import { z } from 'zod'

/**
 * Environment variable schema and validation
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  APP_VERSION: z.string().default('1.0.0'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Database (optional if using Supabase)
  DATABASE_URL: z.string().optional(),
  DATABASE_REPLICA_URL: z.string().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().regex(/^\d+$/).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // Upstash Redis (for rate limiting)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // OpenAI (for AI features)
  OPENAI_API_KEY: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),

  // Cron
  CRON_SECRET: z.string().min(32).optional(),

  // Analytics
  ENABLE_VITALS_LOGGING: z.string().transform(val => val === 'true').default('false'),
  ANALYTICS_ENDPOINT: z.string().url().optional(),
})

// Parse and validate environment variables
function validateEnv() {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:')
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }

  return parsed.data
}

// Export validated environment variables
export const env = validateEnv()

// Environment-specific configurations
export const config = {
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  // Feature flags based on environment
  features: {
    aiInsights: !!env.OPENAI_API_KEY,
    emailNotifications: !!env.RESEND_API_KEY,
    distributedCache: !!env.UPSTASH_REDIS_REST_URL,
    jobQueue: !!env.REDIS_HOST,
    performanceMonitoring: env.ENABLE_VITALS_LOGGING,
  },

  // Service URLs
  services: {
    supabase: {
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    redis: {
      host: env.REDIS_HOST,
      port: parseInt(env.REDIS_PORT),
      password: env.REDIS_PASSWORD,
    },
    upstash: {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    },
  },

  // Rate limiting configuration
  rateLimits: {
    api: { requests: 100, window: '1m' },
    auth: { requests: 5, window: '15m' },
    export: { requests: 10, window: '1h' },
    bulk: { requests: 5, window: '1h' },
    ai: { requests: 50, window: '1h' },
  },

  // Cache TTLs
  cache: {
    short: 60, // 1 minute
    medium: 300, // 5 minutes
    long: 3600, // 1 hour
    day: 86400, // 24 hours
  },

  // Tenant limits by tier
  tenantLimits: {
    free: {
      maxConnections: 10,
      maxApiCallsPerHour: 1000,
      maxStorageGb: 1,
      maxUsers: 5,
    },
    starter: {
      maxConnections: 25,
      maxApiCallsPerHour: 10000,
      maxStorageGb: 10,
      maxUsers: 25,
    },
    professional: {
      maxConnections: 100,
      maxApiCallsPerHour: 100000,
      maxStorageGb: 100,
      maxUsers: 100,
    },
    enterprise: {
      maxConnections: 500,
      maxApiCallsPerHour: 1000000,
      maxStorageGb: 1000,
      maxUsers: 1000,
    },
  },
}

// Type-safe environment variable access
export type Env = z.infer<typeof envSchema>
export type Config = typeof config