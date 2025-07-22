# PRP-001A: Public Website Foundation

## Goal

Create a comprehensive public-facing website with proper landing pages, marketing content, navigation, and foundational pages that provide a complete visitor-to-customer journey. This establishes the marketing presence and user acquisition funnel.

## Why This Matters

- **User Acquisition**: Professional landing pages convert visitors into customers
- **Trust Building**: Complete website with legal pages and company info builds credibility
- **SEO Foundation**: Proper content structure improves search visibility
- **User Journey**: Clear path from discovery to signup increases conversion
- **Brand Presence**: Consistent design and messaging reinforces brand identity

## What We're Building

A complete public website including:

1. Enhanced homepage with real content
2. Feature pages showcasing product capabilities
3. About/company pages with team and mission
4. Legal pages (terms, privacy, cookies)
5. Contact page with form submission
6. Improved public navigation with CTAs
7. SEO optimization and analytics integration

## Context & References

### Documentation & Resources

- **Next.js App Router**: https://nextjs.org/docs/app - Latest routing patterns
- **SEO Best Practices**: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- **Vercel Analytics**: https://vercel.com/analytics - Performance tracking
- **React Hook Form**: https://react-hook-form.com/ - Form handling
- **Resend**: https://resend.com/docs - Email service for contact forms

### Existing Components

- `/app/page.tsx` - Current homepage (needs enhancement)
- `/components/homepage/*` - Marketing components to reuse/enhance
- `/components/wrapper/navbar.tsx` - Public navigation (already updated for Supabase)

## Implementation Blueprint

### Phase 1: Homepage Enhancement

```typescript
// app/page.tsx
import { Metadata } from 'next'
import { HeroSection } from '@/components/marketing/hero-section'
import { FeaturesGrid } from '@/components/marketing/features-grid'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { Testimonials } from '@/components/marketing/testimonials'
import { CTASection } from '@/components/marketing/cta-section'
import { TrustedBy } from '@/components/marketing/trusted-by'

export const metadata: Metadata = {
  title: 'TruthSource - B2B E-commerce Data Accuracy Platform',
  description: 'Sync inventory, pricing, and customer data across NetSuite, Shopify, and more. Real-time accuracy for B2B operations.',
  keywords: ['B2B', 'inventory sync', 'NetSuite', 'Shopify', 'data accuracy'],
  openGraph: {
    title: 'TruthSource - B2B E-commerce Data Accuracy Platform',
    description: 'Keep your B2B data in sync across all platforms',
    images: ['/og-image.png'],
  },
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustedBy />
      <FeaturesGrid />
      <HowItWorks />
      <Testimonials />
      <CTASection />
    </>
  )
}
```

### Phase 2: Feature Pages

```typescript
// app/features/inventory-sync/page.tsx
import { Metadata } from 'next'
import { FeatureHero } from '@/components/marketing/feature-hero'
import { BenefitsList } from '@/components/marketing/benefits-list'
import { IntegrationLogos } from '@/components/marketing/integration-logos'
import { ComparisonTable } from '@/components/marketing/comparison-table'
import { FeatureCTA } from '@/components/marketing/feature-cta'

export const metadata: Metadata = {
  title: 'Real-time Inventory Sync - TruthSource',
  description: 'Keep inventory levels accurate across all your sales channels with real-time synchronization.',
}

const benefits = [
  {
    title: 'Prevent Overselling',
    description: 'Real-time updates ensure you never sell products you don\'t have.',
    icon: 'shield-check',
  },
  {
    title: 'Multi-warehouse Support',
    description: 'Track inventory across unlimited warehouse locations.',
    icon: 'warehouse',
  },
  {
    title: 'Automatic Reconciliation',
    description: 'Identify and resolve discrepancies automatically.',
    icon: 'refresh',
  },
]

export default function InventorySyncPage() {
  return (
    <div className="flex flex-col">
      <FeatureHero
        title="Real-time Inventory Sync"
        subtitle="Never oversell again with accurate inventory across all channels"
        videoUrl="/demos/inventory-sync.mp4"
      />
      <BenefitsList benefits={benefits} />
      <IntegrationLogos category="inventory" />
      <ComparisonTable />
      <FeatureCTA />
    </div>
  )
}
```

### Phase 3: Company Pages

```typescript
// app/about/page.tsx
import { TeamGrid } from '@/components/company/team-grid'
import { CompanyValues } from '@/components/company/values'
import { CompanyStats } from '@/components/company/stats'
import { CompanyStory } from '@/components/company/story'

const teamMembers = [
  {
    name: 'Sarah Chen',
    role: 'CEO & Co-founder',
    image: '/team/sarah.jpg',
    bio: 'Former VP of Operations at a $100M B2B distributor.',
    linkedin: 'https://linkedin.com/in/sarahchen',
  },
  // ... more team members
]

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">About TruthSource</h1>
        <CompanyStory />
        <CompanyValues />
        <CompanyStats />
        <TeamGrid members={teamMembers} />
      </div>
    </div>
  )
}
```

### Phase 4: Legal Pages

```typescript
// app/legal/terms/page.tsx
import { LegalLayout } from '@/components/legal/legal-layout'
import { TableOfContents } from '@/components/legal/table-of-contents'
import termsContent from '@/content/legal/terms-of-service.mdx'

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      lastUpdated="2024-01-15"
      downloadUrl="/legal/terms-of-service.pdf"
    >
      <TableOfContents content={termsContent} />
      <div className="prose prose-gray max-w-none">
        {termsContent}
      </div>
    </LegalLayout>
  )
}
```

### Phase 5: Contact Page

```typescript
// app/contact/page.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { ContactForm } from '@/components/forms/contact-form'
import { ContactInfo } from '@/components/company/contact-info'
import { contactSchema, type ContactFormData } from '@/lib/schemas/contact'

export default function ContactPage() {
  const [loading, setLoading] = useState(false)

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  })

  const onSubmit = async (data: ContactFormData) => {
    setLoading(true)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to send message')

      toast.success('Message sent! We\'ll get back to you soon.')
      form.reset()
    } catch (error) {
      toast.error('Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Contact Us</h1>
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Send us a message</h2>
            <ContactForm form={form} onSubmit={onSubmit} loading={loading} />
          </Card>
          <ContactInfo />
        </div>
      </div>
    </div>
  )
}
```

### Phase 6: Enhanced Navigation

```typescript
// components/marketing/public-header.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { NavigationMenu } from '@/components/ui/navigation-menu'
import { MobileMenu } from './mobile-menu'

const navigation = {
  features: [
    { name: 'Inventory Sync', href: '/features/inventory-sync' },
    { name: 'Pricing Rules', href: '/features/pricing-rules' },
    { name: 'Customer Portal', href: '/features/customer-portal' },
    { name: 'Analytics', href: '/features/analytics' },
  ],
  solutions: [
    { name: 'For Distributors', href: '/solutions/distributors' },
    { name: 'For Manufacturers', href: '/solutions/manufacturers' },
    { name: 'For Retailers', href: '/solutions/retailers' },
  ],
  resources: [
    { name: 'Documentation', href: '/docs' },
    { name: 'API Reference', href: '/developers' },
    { name: 'Blog', href: '/blog' },
    { name: 'Case Studies', href: '/case-studies' },
  ],
  company: [
    { name: 'About', href: '/about' },
    { name: 'Careers', href: '/careers' },
    { name: 'Contact', href: '/contact' },
  ],
}

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`
      fixed top-0 w-full z-50 transition-all duration-200
      ${scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm' : 'bg-transparent'}
    `}>
      <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-2xl font-bold">TruthSource</span>
        </Link>

        <NavigationMenu className="hidden lg:flex">
          {/* Navigation items */}
        </NavigationMenu>

        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Start free trial</Button>
          </Link>
          <MobileMenu navigation={navigation} />
        </div>
      </nav>
    </header>
  )
}
```

### Phase 7: SEO & Analytics

```typescript
// app/layout.tsx additions
import { GoogleAnalytics } from '@next/third-parties/google'
import { JsonLd } from '@/components/seo/json-ld'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd />
        {children}
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
      </body>
    </html>
  )
}

// components/seo/json-ld.tsx
export function JsonLd() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TruthSource',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}
```

## Validation Requirements

### Level 0: Content & Design

- [ ] All pages have real, compelling content (no lorem ipsum)
- [ ] Consistent design language across all pages
- [ ] Mobile-responsive on all breakpoints
- [ ] Images optimized and loading quickly
- [ ] Brand colors and typography consistent

### Level 1: Technical Implementation

- [ ] All TypeScript types properly defined
- [ ] No console errors or warnings
- [ ] Forms validated with proper error messages
- [ ] Loading states for all async operations
- [ ] Proper meta tags on all pages

### Level 2: SEO & Performance

- [ ] Lighthouse score > 90 for all metrics
- [ ] Proper heading hierarchy (h1, h2, etc.)
- [ ] Alt text for all images
- [ ] Open Graph tags for social sharing
- [ ] XML sitemap generated

### Level 3: User Experience

- [ ] Clear CTAs on every page
- [ ] Newsletter signup integrated
- [ ] Contact form sends emails
- [ ] Navigation works intuitively
- [ ] Footer has all important links

### Level 4: Analytics & Tracking

- [ ] Google Analytics properly configured
- [ ] Conversion events tracked
- [ ] Page views recorded
- [ ] Form submissions tracked
- [ ] 404 errors monitored

## Files to Create/Modify

```yaml
CREATE:
  - app/features/*/page.tsx # Feature showcase pages
  - app/about/page.tsx # About page
  - app/contact/page.tsx # Contact page
  - app/legal/*/page.tsx # Legal pages
  - app/careers/page.tsx # Careers page
  - components/marketing/* # Marketing components
  - components/company/* # Company info components
  - components/legal/* # Legal page components
  - components/forms/contact-form.tsx # Contact form
  - lib/schemas/contact.ts # Form validation
  - content/legal/*.mdx # Legal content files
  - public/team/*.jpg # Team photos
  - app/api/contact/route.ts # Contact form handler

MODIFY:
  - app/page.tsx # Enhance homepage
  - app/layout.tsx # Add analytics, SEO
  - components/wrapper/navbar.tsx # Already updated for Supabase
  - public/sitemap.xml # Update with all pages
```

## Success Metrics

- [ ] Lighthouse scores > 90 across all pages
- [ ] Time to interactive < 3 seconds
- [ ] Contact form submission works
- [ ] All navigation links functional
- [ ] Mobile experience smooth
- [ ] SEO meta tags present on all pages
- [ ] Analytics tracking page views
- [ ] Legal pages accessible from footer

## Dependencies

- PRP-001: Next.js setup ✅
- PRP-003: Authentication (for login/signup links) ✅

## Notes

- Content can be enhanced iteratively
- Consider A/B testing for hero sections
- Plan for internationalization in the future
- Ensure WCAG AA compliance for accessibility
