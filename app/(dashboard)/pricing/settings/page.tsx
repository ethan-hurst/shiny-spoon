import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PricingSettingsForm } from '@/components/features/pricing/pricing-settings-form'
import { getApprovalRules } from '@/app/actions/pricing'

export const metadata: Metadata = {
  title: 'Pricing Settings | TruthSource',
  description: 'Configure pricing rules and approval settings',
}

export default async function PricingSettingsPage() {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
    throw new Error('Access denied. Admin privileges required.')
  }

  // Get current approval rules
  const rulesResult = await getApprovalRules()
  if (!rulesResult.success || !rulesResult.data) {
    throw new Error(rulesResult.error || 'Failed to load approval rules')
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Pricing Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure approval rules and pricing policies
          </p>
        </div>

        <PricingSettingsForm initialData={rulesResult.data} />
      </div>
    </div>
  )
}