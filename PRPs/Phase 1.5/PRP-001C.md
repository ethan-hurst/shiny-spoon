# PRP-001C: Customer Portal & Self-Service

## Goal

Build a comprehensive customer portal where users can manage their subscriptions, view invoices, update payment methods, access API keys, and monitor their usage. This reduces support burden and improves customer satisfaction through self-service capabilities.

## Why This Matters

- **Support Efficiency**: 70% of support tickets are billing/account related
- **Customer Satisfaction**: Users expect self-service options
- **Revenue Protection**: Easy payment updates reduce involuntary churn
- **Transparency**: Usage visibility helps customers understand value
- **Upsell Opportunities**: Clear limits encourage plan upgrades

## What We're Building

A complete customer portal featuring:

1. Subscription management with plan changes
2. Billing history and invoice downloads
3. Payment method management
4. Usage dashboard with limits
5. API key management
6. Team member invitations
7. Notification preferences

## Context & References

### Documentation & Resources

- **Stripe Customer Portal**: https://stripe.com/docs/billing/subscriptions/customer-portal
- **Stripe Elements**: https://stripe.com/docs/payments/elements
- **Recharts**: https://recharts.org/ - Usage charts
- **React PDF**: https://react-pdf.org/ - Invoice generation

### Design Patterns

- **Linear Settings**: https://linear.app/settings - Clean settings UI
- **Vercel Dashboard**: https://vercel.com/dashboard - Usage metrics
- **GitHub Settings**: https://github.com/settings - Organization management

## Implementation Blueprint

### Phase 1: Account Overview

```typescript
// app/portal/page.tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSubscription, getUsageStats, getRecentActivity } from '@/lib/billing'
import { AccountOverview } from '@/components/portal/account-overview'
import { QuickActions } from '@/components/portal/quick-actions'
import { UsageSummary } from '@/components/portal/usage-summary'
import { RecentActivity } from '@/components/portal/recent-activity'

export default async function CustomerPortalPage() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  const [subscription, usage, activity] = await Promise.all([
    getSubscription(profile.organization_id),
    getUsageStats(profile.organization_id),
    getRecentActivity(profile.organization_id),
  ])

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Account Overview</h1>

      <div className="grid gap-6 mb-8">
        <AccountOverview
          organization={profile.organizations}
          subscription={subscription}
        />

        <QuickActions subscription={subscription} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <UsageSummary usage={usage} limits={subscription.limits} />
        <RecentActivity activity={activity} />
      </div>
    </div>
  )
}
```

### Phase 2: Subscription Management

```typescript
// app/portal/subscription/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlanComparison } from '@/components/portal/plan-comparison'
import { BillingCycle } from '@/components/portal/billing-cycle'
import { CancelDialog } from '@/components/portal/cancel-dialog'
import { toast } from 'sonner'

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    yearlyPrice: 990,
    features: [
      'Up to 1,000 products',
      '2 warehouse locations',
      '5,000 API calls/month',
      'Email support',
    ],
    limits: {
      products: 1000,
      warehouses: 2,
      apiCalls: 5000,
    },
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    popular: true,
    features: [
      'Up to 10,000 products',
      '10 warehouse locations',
      '50,000 API calls/month',
      'Priority support',
      'Advanced analytics',
    ],
    limits: {
      products: 10000,
      warehouses: 10,
      apiCalls: 50000,
    },
  },
  {
    id: 'scale',
    name: 'Scale',
    monthlyPrice: 799,
    yearlyPrice: 7990,
    features: [
      'Unlimited products',
      'Unlimited warehouses',
      '500,000 API calls/month',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
    ],
    limits: {
      products: -1, // unlimited
      warehouses: -1,
      apiCalls: 500000,
    },
  },
]

export default function SubscriptionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isYearly, setIsYearly] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const handlePlanChange = async (planId: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, interval: isYearly ? 'year' : 'month' }),
      })

      if (!response.ok) throw new Error('Failed to change plan')

      const { sessionUrl } = await response.json()

      if (sessionUrl) {
        // Redirect to Stripe for payment update if needed
        window.location.href = sessionUrl
      } else {
        toast.success('Plan updated successfully')
        router.refresh()
      }
    } catch (error) {
      toast.error('Failed to update plan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Subscription & Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing preferences
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>You're currently on the Growth plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">$299/month</p>
              <p className="text-sm text-muted-foreground">Next billing date: Feb 1, 2024</p>
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
                Cancel Subscription
              </Button>
              <Button onClick={() => router.push('/portal/billing')}>
                Update Payment Method
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <BillingCycle isYearly={isYearly} onChange={setIsYearly} />
      </div>

      <PlanComparison
        plans={plans}
        currentPlan="growth"
        isYearly={isYearly}
        onSelectPlan={handlePlanChange}
        loading={loading}
      />

      <CancelDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
      />
    </div>
  )
}
```

### Phase 3: Billing & Invoices

```typescript
// app/portal/billing/page.tsx
import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { getInvoices, getPaymentMethods } from '@/lib/billing'
import { PaymentMethods } from '@/components/portal/payment-methods'
import { InvoiceHistory } from '@/components/portal/invoice-history'
import { BillingAddress } from '@/components/portal/billing-address'
import { TaxInformation } from '@/components/portal/tax-information'
import { Skeleton } from '@/components/ui/skeleton'

export default async function BillingPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user!.id)
    .single()

  const [invoices, paymentMethods] = await Promise.all([
    getInvoices(profile!.organization_id),
    getPaymentMethods(profile!.organization_id),
  ])

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Billing & Invoices</h1>

      <div className="space-y-6">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <PaymentMethods methods={paymentMethods} />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-96" />}>
          <InvoiceHistory invoices={invoices} />
        </Suspense>

        <BillingAddress />
        <TaxInformation />
      </div>
    </div>
  )
}

// components/portal/invoice-history.tsx
'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Download, ExternalLink } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function InvoiceHistory({ invoices }: { invoices: Invoice[] }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (invoiceId: string) => {
    setDownloading(invoiceId)
    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/download`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoiceId}.pdf`
      a.click()
    } finally {
      setDownloading(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>Download invoices and receipts</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>
                  {format(new Date(invoice.created), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  ${(invoice.amount_paid / 100).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                  >
                    {invoice.status}
                  </Badge>
                </TableCell>
                <TableCell>{invoice.number}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(invoice.id)}
                    disabled={downloading === invoice.id}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(invoice.hosted_invoice_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

### Phase 4: Usage Dashboard

```typescript
// app/portal/usage/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { getUsageMetrics, getUsageTrends } from '@/lib/analytics'
import { UsageChart } from '@/components/portal/usage-chart'
import { UsageBreakdown } from '@/components/portal/usage-breakdown'
import { ApiCallsTable } from '@/components/portal/api-calls-table'
import { ExportUsageButton } from '@/components/portal/export-usage-button'

export default async function UsagePage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, organizations(subscription_tier)')
    .eq('user_id', user!.id)
    .single()

  const [metrics, trends, apiCalls] = await Promise.all([
    getUsageMetrics(profile!.organization_id),
    getUsageTrends(profile!.organization_id, 30), // Last 30 days
    getRecentApiCalls(profile!.organization_id),
  ])

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Usage & Limits</h1>
          <p className="text-muted-foreground">
            Monitor your usage across all features
          </p>
        </div>
        <ExportUsageButton organizationId={profile!.organization_id} />
      </div>

      <div className="grid gap-6 mb-8">
        <UsageBreakdown
          metrics={metrics}
          tier={profile!.organizations.subscription_tier}
        />

        <UsageChart trends={trends} />
      </div>

      <ApiCallsTable calls={apiCalls} />
    </div>
  )
}

// components/portal/usage-breakdown.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

const limits = {
  starter: { products: 1000, warehouses: 2, apiCalls: 5000 },
  growth: { products: 10000, warehouses: 10, apiCalls: 50000 },
  scale: { products: -1, warehouses: -1, apiCalls: 500000 },
}

export function UsageBreakdown({ metrics, tier }: {
  metrics: UsageMetrics
  tier: 'starter' | 'growth' | 'scale'
}) {
  const tierLimits = limits[tier]

  const items = [
    {
      name: 'Products',
      current: metrics.products,
      limit: tierLimits.products,
      unit: 'products',
    },
    {
      name: 'Warehouses',
      current: metrics.warehouses,
      limit: tierLimits.warehouses,
      unit: 'locations',
    },
    {
      name: 'API Calls',
      current: metrics.apiCalls,
      limit: tierLimits.apiCalls,
      unit: 'calls this month',
    },
  ]

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {items.map((item) => {
        const percentage = item.limit === -1
          ? 0
          : (item.current / item.limit) * 100
        const isNearLimit = percentage > 80
        const isAtLimit = percentage >= 100

        return (
          <Card key={item.name} className={isAtLimit ? 'border-destructive' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                {item.name}
                {isNearLimit && (
                  <Badge variant={isAtLimit ? 'destructive' : 'secondary'}>
                    {isAtLimit ? 'Limit reached' : 'Near limit'}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {item.current.toLocaleString()}
                {item.limit !== -1 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}/ {item.limit.toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{item.unit}</p>
              {item.limit !== -1 && (
                <Progress value={percentage} className="mt-2" />
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
```

### Phase 5: API Key Management

```typescript
// app/portal/api-keys/page.tsx
'use client'

import { useState } from 'react'
import { Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreateApiKeyDialog } from '@/components/portal/create-api-key-dialog'
import { DeleteApiKeyDialog } from '@/components/portal/delete-api-key-dialog'
import { toast } from 'sonner'

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showKey, setShowKey] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteKey, setDeleteKey] = useState<ApiKey | null>(null)

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key)
    toast.success('API key copied to clipboard')
  }

  const handleCreate = async (data: CreateApiKeyData) => {
    try {
      const response = await fetch('/api/portal/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to create API key')

      const newKey = await response.json()
      setKeys([...keys, newKey])
      toast.success('API key created successfully')
    } catch (error) {
      toast.error('Failed to create API key')
    }
  }

  const handleDelete = async (keyId: string) => {
    try {
      const response = await fetch(`/api/portal/api-keys/${keyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete API key')

      setKeys(keys.filter(k => k.id !== keyId))
      toast.success('API key deleted')
    } catch (error) {
      toast.error('Failed to delete API key')
    }
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for programmatic access
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active API Keys</CardTitle>
          <CardDescription>
            Keep your API keys secure and rotate them regularly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{key.name}</p>
                    <Badge variant="outline">{key.permissions}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <code className="bg-muted px-2 py-1 rounded">
                      {showKey === key.id
                        ? key.key
                        : `${key.key.slice(0, 8)}...${key.key.slice(-4)}`}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                    >
                      {showKey === key.id ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(key.key)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(key.created_at).toLocaleDateString()} •
                    Last used {key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteKey(key)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CreateApiKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />

      <DeleteApiKeyDialog
        apiKey={deleteKey}
        onClose={() => setDeleteKey(null)}
        onDelete={handleDelete}
      />
    </div>
  )
}
```

### Phase 6: Team Management

```typescript
// app/portal/team/page.tsx
import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { TeamMembers } from '@/components/portal/team-members'
import { InviteTeamMember } from '@/components/portal/invite-team-member'
import { PendingInvites } from '@/components/portal/pending-invites'
import { TeamActivity } from '@/components/portal/team-activity'

export default async function TeamPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user!.id)
    .single()

  const [members, invites, activity] = await Promise.all([
    getTeamMembers(profile!.organization_id),
    getPendingInvites(profile!.organization_id),
    getTeamActivity(profile!.organization_id),
  ])

  const canInvite = profile!.role === 'owner' || profile!.role === 'admin'

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Team Management</h1>
          <p className="text-muted-foreground">
            Manage team members and permissions
          </p>
        </div>
        {canInvite && <InviteTeamMember organizationId={profile!.organization_id} />}
      </div>

      <div className="space-y-6">
        <TeamMembers members={members} currentUserId={user!.id} />
        {invites.length > 0 && <PendingInvites invites={invites} />}
        <TeamActivity activity={activity} />
      </div>
    </div>
  )
}
```

## Validation Requirements

### Level 0: Portal Access

- [ ] Authentication required for all pages
- [ ] Organization context loaded
- [ ] Role-based permissions enforced
- [ ] Navigation between sections works

### Level 1: Billing Features

- [ ] Current plan displayed correctly
- [ ] Plan changes process through Stripe
- [ ] Invoices downloadable
- [ ] Payment methods updatable
- [ ] Subscription cancellable

### Level 2: Usage Tracking

- [ ] Metrics calculate correctly
- [ ] Charts render with real data
- [ ] Export functionality works
- [ ] API calls logged properly
- [ ] Limits enforced

### Level 3: Team Management

- [ ] Invites send emails
- [ ] Role changes save
- [ ] Member removal works
- [ ] Activity tracked
- [ ] Permissions respected

### Level 4: API Keys

- [ ] Keys generated securely
- [ ] Permissions enforced
- [ ] Last used updates
- [ ] Deletion works
- [ ] Keys work in API calls

## Files to Create/Modify

```yaml
CREATE:
  - app/portal/layout.tsx # Portal layout wrapper
  - app/portal/page.tsx # Account overview
  - app/portal/subscription/page.tsx # Subscription management
  - app/portal/billing/page.tsx # Billing & invoices
  - app/portal/usage/page.tsx # Usage dashboard
  - app/portal/api-keys/page.tsx # API key management
  - app/portal/team/page.tsx # Team management
  - app/portal/notifications/page.tsx # Notification preferences
  - components/portal/* # All portal components
  - app/api/billing/* # Billing API routes
  - app/api/portal/* # Portal API routes
  - lib/billing/* # Billing utilities

MODIFY:
  - app/(dashboard)/settings/page.tsx # Link to portal
  - components/layouts/dashboard-sidebar.tsx # Add portal link
```

## Success Metrics

- [ ] Support tickets reduced by 50%
- [ ] Self-service actions completed
- [ ] Payment failures reduced
- [ ] API adoption increased
- [ ] Team collaboration improved
- [ ] Usage visibility appreciated

## Dependencies

- PRP-001: Next.js setup ✅
- PRP-003: Authentication ✅
- Stripe account and API keys required

## Notes

- Consider adding webhooks for Stripe events
- Plan for granular permissions system
- Add audit logging for compliance
- Consider SSO for enterprise customers
- Monitor self-service adoption rates
