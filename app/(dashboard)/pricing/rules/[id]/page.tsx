import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { PricingRuleForm } from '@/components/features/pricing/pricing-rule-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Edit Pricing Rule',
  description: 'Edit an existing pricing rule',
}

interface EditPricingRulePageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Server component for editing an existing pricing rule.
 *
 * Retrieves the specified pricing rule for the authenticated user's organization, enforcing access control and handling missing data with redirects or 404 responses. Renders a form pre-populated with the rule's details for editing.
 */
export default async function EditPricingRulePage(
  props: EditPricingRulePageProps
) {
  const params = await props.params
  const supabase = await createClient()

  // Get user's organization for security
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    notFound()
  }

  const { data: rule, error } = await supabase
    .from('pricing_rules')
    .select(
      `
      *,
      quantity_breaks (*)
    `
    )
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (error || !rule) {
    notFound()
  }

  return (
    <div className="container py-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Pricing Rule</h1>
        <PricingRuleForm initialData={rule} />
      </div>
    </div>
  )
}
