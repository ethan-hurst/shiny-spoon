import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PricingRuleForm } from '@/components/features/pricing/pricing-rule-form'

export const metadata: Metadata = {
  title: 'Edit Pricing Rule',
  description: 'Edit an existing pricing rule',
}

interface EditPricingRulePageProps {
  params: {
    id: string
  }
}

export default async function EditPricingRulePage({ params }: EditPricingRulePageProps) {
  const supabase = createClient()
  
  const { data: rule, error } = await supabase
    .from('pricing_rules')
    .select(`
      *,
      quantity_breaks (*)
    `)
    .eq('id', params.id)
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