const config = {
  auth: {
    enabled: process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true',
    provider: (process.env.NEXT_PUBLIC_AUTH_PROVIDER as 'clerk' | 'supabase') || 'supabase'
  },
  payments: {
    enabled: process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true'
  }
} as const;

export default config;