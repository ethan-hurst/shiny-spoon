import { Metadata } from 'next'
import { BenefitsList } from '@/components/marketing/benefits-list'
import { ComparisonTable } from '@/components/marketing/comparison-table'
import { FeatureCTA } from '@/components/marketing/feature-cta'
import { FeatureHero } from '@/components/marketing/feature-hero'
import { IntegrationLogos } from '@/components/marketing/integration-logos'
import PageWrapper from '@/components/wrapper/page-wrapper'

export const metadata: Metadata = {
  title: 'Real-time Inventory Sync - TruthSource',
  description:
    'Keep inventory levels accurate across all your sales channels with real-time synchronization. Prevent overselling and stockouts.',
  keywords: [
    'inventory sync',
    'real-time inventory',
    'stock management',
    'multi-channel inventory',
  ],
}

const benefits = [
  {
    title: 'Prevent Overselling',
    description:
      "Real-time updates ensure you never sell products you don't have in stock.",
    icon: 'shield-check',
  },
  {
    title: 'Multi-warehouse Support',
    description:
      'Track inventory across unlimited warehouse locations with zone-based management.',
    icon: 'warehouse',
  },
  {
    title: 'Automatic Reconciliation',
    description:
      'Identify and resolve discrepancies automatically with smart conflict resolution.',
    icon: 'refresh',
  },
  {
    title: 'Bulk Operations',
    description:
      'Update thousands of SKUs at once with our powerful bulk import/export tools.',
    icon: 'zap',
  },
  {
    title: 'Real-time Alerts',
    description:
      'Get notified instantly when stock levels hit reorder points or critical thresholds.',
    icon: 'trending-up',
  },
  {
    title: 'Audit Trail',
    description:
      'Complete history of all inventory changes with user tracking and rollback capability.',
    icon: 'bar-chart',
  },
]

export default function InventorySyncPage() {
  return (
    <PageWrapper>
      <FeatureHero
        title="Real-time Inventory Sync"
        subtitle="Never oversell again. Keep inventory accurate across NetSuite, Shopify, and all your sales channels with sub-second synchronization."
        videoUrl="/demos/inventory-sync.mp4"
      />
      <BenefitsList benefits={benefits} />
      <IntegrationLogos category="inventory" />
      <ComparisonTable />
      <FeatureCTA />
    </PageWrapper>
  )
}
