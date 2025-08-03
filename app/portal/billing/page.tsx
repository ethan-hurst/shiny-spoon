import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { BillingDetails } from '@/components/portal/billing/billing-details'
import { InvoiceHistory } from '@/components/portal/billing/invoice-history'
import { PaymentMethods } from '@/components/portal/billing/payment-methods'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getInvoices, getPaymentMethods, getSubscription } from '@/lib/billing'
import { createClient } from '@/lib/supabase/server'

export default async function BillingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  const [subscription, invoices, paymentMethods] = await Promise.all([
    getSubscription(profile.organization_id),
    getInvoices(profile.organization_id),
    getPaymentMethods(profile.organization_id),
  ])

  const hasActiveSubscription = Boolean(
    subscription && subscription.id !== 'free'
  )
  const hasPastDueInvoice = invoices.some(
    (invoice) => invoice.status === 'past_due'
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing & Invoices</h1>
        <p className="text-muted-foreground mt-2">
          Manage payment methods and download invoices
        </p>
      </div>

      {hasPastDueInvoice && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment Required</AlertTitle>
          <AlertDescription>
            You have an overdue invoice. Please update your payment method to
            avoid service interruption.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {hasActiveSubscription && (
          <BillingDetails
            subscription={subscription}
            organization={profile.organizations}
          />
        )}

        <PaymentMethods
          paymentMethods={paymentMethods}
          hasActiveSubscription={hasActiveSubscription}
        />

        <InvoiceHistory
          invoices={invoices}
          hasActiveSubscription={hasActiveSubscription}
        />
      </div>
    </div>
  )
}
