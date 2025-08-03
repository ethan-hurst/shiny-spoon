import { Metadata } from 'next'
import { BenefitsList } from '@/components/marketing/benefits-list'
import { ComparisonTable } from '@/components/marketing/comparison-table'
import { FeatureCTA } from '@/components/marketing/feature-cta'
import { FeatureHero } from '@/components/marketing/feature-hero'
import { IntegrationLogos } from '@/components/marketing/integration-logos'
import PageWrapper from '@/components/wrapper/page-wrapper'

export const metadata: Metadata = {
  title: 'Dynamic Pricing Rules - TruthSource',
  description:
    'Manage complex B2B pricing with customer-specific rates, volume discounts, and promotional rules that sync across all platforms.',
  keywords: [
    'B2B pricing',
    'dynamic pricing',
    'volume discounts',
    'customer pricing',
    'price sync',
  ],
}

const benefits = [
  {
    title: 'Customer-Specific Pricing',
    description:
      'Set unique pricing tiers for each customer based on contracts, volume, or loyalty.',
    icon: 'users',
  },
  {
    title: 'Volume Discounts',
    description:
      'Automatic quantity breaks and tiered pricing that apply across all channels.',
    icon: 'trending-up',
  },
  {
    title: 'Promotional Rules',
    description:
      'Time-based promotions, seasonal pricing, and special offers managed centrally.',
    icon: 'zap',
  },
  {
    title: 'Margin Protection',
    description:
      'Set minimum margins and get alerts when pricing falls below thresholds.',
    icon: 'shield-check',
  },
  {
    title: 'Multi-Currency Support',
    description:
      'Manage pricing in multiple currencies with automatic exchange rate updates.',
    icon: 'refresh',
  },
  {
    title: 'Price History Tracking',
    description:
      'Complete audit trail of all price changes with rollback capabilities.',
    icon: 'bar-chart',
  },
]

export default function PricingRulesPage() {
  return (
    <PageWrapper>
      <FeatureHero
        title="Dynamic Pricing Rules Engine"
        subtitle="Manage complex B2B pricing scenarios with ease. Customer-specific rates, volume discounts, and promotions that sync everywhere."
        imageUrl="/images/pricing-dashboard.png"
      />
      <BenefitsList benefits={benefits} />
      <IntegrationLogos category="pricing" />
      <ComparisonTable />
      <FeatureCTA />
    </PageWrapper>
  )
}
