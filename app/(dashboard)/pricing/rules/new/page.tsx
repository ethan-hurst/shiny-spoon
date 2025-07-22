import { Metadata } from 'next'
import { PricingRuleForm } from '@/components/features/pricing/pricing-rule-form'

export const metadata: Metadata = {
  title: 'Create Pricing Rule',
  description: 'Create a new pricing rule',
}

export default function NewPricingRulePage() {
  return (
    <div className="container py-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Pricing Rule</h1>
        <PricingRuleForm />
      </div>
    </div>
  )
}
