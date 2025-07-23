/**
 * Billing and subscription plan configuration
 */

export const BILLING_INTERVALS = {
  MONTHLY: 'month',
  YEARLY: 'year',
} as const

export type BillingInterval = typeof BILLING_INTERVALS[keyof typeof BILLING_INTERVALS]

export const SUBSCRIPTION_PLANS = {
  BASIC: {
    id: 'basic',
    name: 'Basic',
    description: 'Essential features you need to get started',
    monthlyPrice: 10,
    yearlyPrice: 100,
    features: [
      'Up to 10,000 products',
      'Up to 100,000 API calls/month',
      '1 warehouse location',
      'Email support',
      'Basic analytics',
    ],
    limits: {
      apiCalls: 100000,
      products: 10000,
      warehouses: 1,
      teamMembers: 3,
    },
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    description: 'Perfect for growing businesses',
    monthlyPrice: 25,
    yearlyPrice: 250,
    features: [
      'Up to 50,000 products',
      'Up to 500,000 API calls/month',
      'Up to 5 warehouse locations',
      'Priority email support',
      'Advanced analytics',
      'API webhooks',
      'Custom integrations',
    ],
    limits: {
      apiCalls: 500000,
      products: 50000,
      warehouses: 5,
      teamMembers: 10,
    },
    popular: true,
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Dedicated support and infrastructure to fit your needs',
    monthlyPrice: null, // Custom pricing
    yearlyPrice: null, // Custom pricing
    features: [
      'Unlimited products',
      'Unlimited API calls',
      'Unlimited warehouse locations',
      '24/7 phone & email support',
      'Custom analytics & reporting',
      'Dedicated account manager',
      'SLA guarantees',
      'Custom integrations',
      'On-premise deployment options',
    ],
    limits: {
      apiCalls: null, // Unlimited
      products: null, // Unlimited
      warehouses: null, // Unlimited
      teamMembers: null, // Unlimited
    },
    exclusive: true,
  },
} as const

export type SubscriptionPlan = typeof SUBSCRIPTION_PLANS[keyof typeof SUBSCRIPTION_PLANS]

export const ANNUAL_DISCOUNT_PERCENTAGE = 17 // 17% off for annual billing (2 months free)

export const BILLING_MESSAGES = {
  ANNUAL_SAVINGS: 'Save 17%',
  ANNUAL_DESCRIPTION: 'Pay annually and get 2 months free on any plan',
  MONTHLY_DESCRIPTION: 'Pay month-to-month with the flexibility to cancel anytime',
  PLAN_LIMIT_REACHED: "You've reached the limit for your plan.",
  UPGRADE_PROMPT: 'Upgrade to continue adding more.',
} as const