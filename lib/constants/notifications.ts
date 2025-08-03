/**
 * Notification preferences configuration
 */

export const NOTIFICATION_CATEGORIES = {
  BILLING: {
    key: 'billing',
    title: 'Billing & Subscription',
    description: 'Notifications about your billing and subscription',
    settings: {
      billingAlerts: {
        key: 'billingAlerts',
        label: 'Billing Alerts',
        description: 'Payment failures, subscription changes, invoices',
        defaultEnabled: true,
      },
    },
  },
  USAGE: {
    key: 'usage',
    title: 'Usage & Limits',
    description: 'Alerts when approaching or exceeding limits',
    settings: {
      usageAlerts: {
        key: 'usageAlerts',
        label: 'Usage Alerts',
        description: 'API limits, storage limits, quota warnings',
        defaultEnabled: true,
      },
    },
  },
  TEAM: {
    key: 'team',
    title: 'Team Activity',
    description: 'Updates about your team',
    settings: {
      teamUpdates: {
        key: 'teamUpdates',
        label: 'Team Updates',
        description: 'New members, role changes, invitations',
        defaultEnabled: true,
      },
    },
  },
  API: {
    key: 'api',
    title: 'API & Integration',
    description: 'Technical updates and changes',
    settings: {
      apiUpdates: {
        key: 'apiUpdates',
        label: 'API Updates',
        description: 'API changes, deprecations, new endpoints',
        defaultEnabled: false,
      },
    },
  },
  PRODUCT: {
    key: 'product',
    title: 'Product Updates',
    description: 'New features and improvements',
    settings: {
      productUpdates: {
        key: 'productUpdates',
        label: 'Product Updates',
        description: 'New features, improvements, announcements',
        defaultEnabled: false,
      },
    },
  },
  SECURITY: {
    key: 'security',
    title: 'Security',
    description: 'Important security notifications',
    settings: {
      securityAlerts: {
        key: 'securityAlerts',
        label: 'Security Alerts',
        description: 'Suspicious activity, login attempts, security updates',
        defaultEnabled: true,
      },
    },
  },
} as const

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailNotifications: true,
  billingAlerts: true,
  usageAlerts: true,
  teamUpdates: true,
  apiUpdates: false,
  productUpdates: false,
  securityAlerts: true,
} as const

export type NotificationPreference =
  keyof typeof DEFAULT_NOTIFICATION_PREFERENCES

export const NOTIFICATION_MESSAGES = {
  PREFERENCES_UPDATED: 'Notification preferences updated',
  EMAIL_SENT: 'Notification email sent',
  UNSUBSCRIBED: 'You have been unsubscribed from email notifications',
} as const
