import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSubscription, getInvoices, getPaymentMethods } from '@/lib/billing'
import { PaymentMethods } from '@/components/portal/billing/payment-methods'
import { InvoiceHistory } from '@/components/portal/billing/invoice-history'
import { BillingDetails } from '@/components/portal/billing/billing-details'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export default async function BillingPage() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
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

  const hasActiveSubscription = subscription && subscription.id !== 'free'
  const hasPastDueInvoice = invoices.some(invoice => invoice.status === 'past_due')

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
            You have an overdue invoice. Please update your payment method to avoid service interruption.
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