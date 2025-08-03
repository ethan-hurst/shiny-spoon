// Billing types for subscription management

// Subscription data returned from our billing functions
export interface SubscriptionData {
  id: string
  plan: 'starter' | 'growth' | 'scale' | 'enterprise'
  interval: 'month' | 'year'
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEnd?: Date
  limits?: {
    products: number
    warehouses: number
    apiCalls: number
  }
}

// Organization billing information
export interface Organization {
  id: string
  name: string
  contact_email: string
  billing_email?: string
  tax_id?: string
  billing_address?: BillingAddress
}

// Billing address structure
export interface BillingAddress {
  line1: string
  line2?: string
  city: string
  state: string
  postal_code: string
  country: string
}

// Payment method from Stripe
export interface PaymentMethod {
  id: string
  brand?: string
  last4?: string
  exp_month?: number
  exp_year?: number
}

// Invoice data from Stripe
export interface Invoice {
  id: string
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | 'past_due'
  amount_paid: number
  amount_due: number
  currency: string
  period_start: number
  period_end: number
  created: number
  invoice_pdf?: string | null
  hosted_invoice_url?: string | null
}

// Price structure for plans
export interface PlanPricing {
  month: number
  year: number
}

// Subscription plan configuration
export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  monthlyPriceId?: string
  yearlyPriceId?: string
  monthlyPrice: number
  yearlyPrice: number
  popular?: boolean
  features: string[]
  limits: {
    products: number
    warehouses: number
    apiCalls: number
  }
}
