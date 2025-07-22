import { Metadata } from 'next'
import { FeatureHero } from '@/components/marketing/feature-hero'
import { BenefitsList } from '@/components/marketing/benefits-list'
import { IntegrationLogos } from '@/components/marketing/integration-logos'
import { ComparisonTable } from '@/components/marketing/comparison-table'
import { FeatureCTA } from '@/components/marketing/feature-cta'
import PageWrapper from '@/components/wrapper/page-wrapper'

export const metadata: Metadata = {
  title: 'B2B Customer Portal - TruthSource',
  description: 'Give your B2B customers self-service access to real-time inventory, custom pricing, order history, and account management.',
  keywords: ['B2B portal', 'customer portal', 'self-service', 'B2B ecommerce', 'customer experience'],
}

const benefits = [
  {
    title: 'Self-Service Ordering',
    description: 'Customers can check real-time inventory, view their pricing, and place orders 24/7.',
    icon: 'users',
  },
  {
    title: 'Account Management',
    description: 'View invoices, track shipments, manage users, and download statements.',
    icon: 'shield-check',
  },
  {
    title: 'Custom Pricing Display',
    description: 'Each customer sees their negotiated prices, volume discounts, and available credit.',
    icon: 'trending-up',
  },
  {
    title: 'Quick Reorder',
    description: 'One-click reordering from order history with smart suggestions.',
    icon: 'refresh',
  },
  {
    title: 'Mobile Responsive',
    description: 'Full functionality on any device for sales reps and customers on the go.',
    icon: 'zap',
  },
  {
    title: 'White Label Options',
    description: 'Customize branding, colors, and domain to match your company identity.',
    icon: 'lock',
  },
]

export default function CustomerPortalPage() {
  return (
    <PageWrapper>
      <FeatureHero
        title="B2B Customer Portal"
        subtitle="Empower your customers with 24/7 self-service access to inventory, pricing, and account management. Reduce support costs while improving customer satisfaction."
        videoUrl="/demos/customer-portal.mp4"
      />
      <BenefitsList benefits={benefits} />
      <IntegrationLogos category="customers" />
      <ComparisonTable />
      <FeatureCTA />
    </PageWrapper>
  )
}