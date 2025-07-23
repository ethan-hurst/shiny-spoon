/**
 * Subscription plan limits configuration
 */

export interface SubscriptionLimits {
  apiKeys: number
  requests: {
    perMonth: number
    perMinute: number
  }
  features: {
    customDomain: boolean
    sso: boolean
    auditLog: boolean
    multiWarehouse: boolean
  }
}

export type SubscriptionPlan = 'starter' | 'growth' | 'scale' | 'enterprise'

export const SUBSCRIPTION_LIMITS: Record<SubscriptionPlan, SubscriptionLimits> = {
  starter: {
    apiKeys: 3,
    requests: {
      perMonth: 10000,
      perMinute: 60,
    },
    features: {
      customDomain: false,
      sso: false,
      auditLog: false,
      multiWarehouse: false,
    },
  },
  growth: {
    apiKeys: 10,
    requests: {
      perMonth: 100000,
      perMinute: 300,
    },
    features: {
      customDomain: true,
      sso: false,
      auditLog: true,
      multiWarehouse: true,
    },
  },
  scale: {
    apiKeys: -1, // unlimited
    requests: {
      perMonth: 1000000,
      perMinute: 1000,
    },
    features: {
      customDomain: true,
      sso: true,
      auditLog: true,
      multiWarehouse: true,
    },
  },
  enterprise: {
    apiKeys: -1, // unlimited
    requests: {
      perMonth: -1, // unlimited
      perMinute: -1, // unlimited
    },
    features: {
      customDomain: true,
      sso: true,
      auditLog: true,
      multiWarehouse: true,
    },
  },
}

export const DEFAULT_PLAN: SubscriptionPlan = 'starter'

/**
 * Check if a limit is exceeded
 * @param limit The limit value (-1 means unlimited)
 * @param current The current value
 * @returns true if limit is exceeded
 */
export function isLimitExceeded(limit: number, current: number): boolean {
  return limit !== -1 && current >= limit
}