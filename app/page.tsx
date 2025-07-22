import { Metadata } from 'next'
import { HeroSection } from '@/components/marketing/hero-section'
import { FeaturesGrid } from '@/components/marketing/features-grid'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { Testimonials } from '@/components/marketing/testimonials'
import { CTASection } from '@/components/marketing/cta-section'
import { TrustedBy } from '@/components/marketing/trusted-by'
import PageWrapper from '@/components/wrapper/page-wrapper'

export const metadata: Metadata = {
  title: 'TruthSource - B2B E-commerce Data Accuracy Platform',
  description: 'Sync inventory, pricing, and customer data across NetSuite, Shopify, and more. Real-time accuracy for B2B operations.',
  keywords: ['B2B', 'inventory sync', 'NetSuite', 'Shopify', 'data accuracy', 'pricing sync', 'order management'],
  openGraph: {
    title: 'TruthSource - B2B E-commerce Data Accuracy Platform',
    description: 'Keep your B2B data in sync across all platforms',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TruthSource - B2B E-commerce Data Accuracy Platform',
    description: 'Keep your B2B data in sync across all platforms',
    images: ['/og-image.png'],
  },
}

export default function HomePage() {
  return (
    <PageWrapper>
      <HeroSection />
      <TrustedBy />
      <FeaturesGrid />
      <HowItWorks />
      <Testimonials />
      <CTASection />
    </PageWrapper>
  )
}