import { Metadata } from 'next'
import { BenefitsList } from '@/components/marketing/benefits-list'
import { ComparisonTable } from '@/components/marketing/comparison-table'
import { FeatureCTA } from '@/components/marketing/feature-cta'
import { FeatureHero } from '@/components/marketing/feature-hero'
import { IntegrationLogos } from '@/components/marketing/integration-logos'
import PageWrapper from '@/components/wrapper/page-wrapper'

export const metadata: Metadata = {
  title: 'Analytics & Insights - TruthSource',
  description:
    'Monitor data accuracy, track sync performance, and get actionable insights to optimize your B2B operations.',
  keywords: [
    'B2B analytics',
    'data accuracy',
    'sync monitoring',
    'business intelligence',
    'reporting',
  ],
}

const benefits = [
  {
    title: 'Real-time Dashboards',
    description:
      'Monitor sync status, data accuracy, and system health with live dashboards.',
    icon: 'bar-chart',
  },
  {
    title: 'Accuracy Metrics',
    description:
      'Track data discrepancies, resolution rates, and accuracy trends over time.',
    icon: 'trending-up',
  },
  {
    title: 'Performance Monitoring',
    description:
      'Monitor sync speeds, API performance, and system uptime with detailed logs.',
    icon: 'zap',
  },
  {
    title: 'Custom Reports',
    description:
      'Build custom reports with drag-and-drop interface and schedule automated delivery.',
    icon: 'refresh',
  },
  {
    title: 'Anomaly Detection',
    description:
      'AI-powered alerts for unusual patterns in inventory, pricing, or order data.',
    icon: 'shield-check',
  },
  {
    title: 'Export & Integration',
    description:
      'Export data to Excel, connect to BI tools, or use our API for custom analytics.',
    icon: 'users',
  },
]

export default function AnalyticsPage() {
  return (
    <PageWrapper>
      <FeatureHero
        title="Analytics & Insights"
        subtitle="Get complete visibility into your data synchronization. Monitor accuracy, track performance, and make data-driven decisions."
        imageUrl="/images/analytics-dashboard.png"
      />
      <BenefitsList benefits={benefits} />
      <IntegrationLogos category="all" />
      <ComparisonTable />
      <FeatureCTA />
    </PageWrapper>
  )
}
