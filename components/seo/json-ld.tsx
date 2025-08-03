interface PriceSpecification {
  '@type': 'PriceSpecification'
  price: string
  priceCurrency: string
  eligibleQuantity: {
    '@type': 'QuantitativeValue'
    value: string
    unitText: string
  }
}

interface Offer {
  '@type': 'Offer'
  price: string
  priceCurrency: string
  priceSpecification: PriceSpecification
}

interface AggregateRating {
  '@type': 'AggregateRating'
  ratingValue: string
  reviewCount: string
  bestRating: string
  worstRating: string
}

interface Organization {
  '@type': 'Organization'
  name: string
  url: string
}

interface SoftwareApplication {
  '@context': 'https://schema.org'
  '@type': 'SoftwareApplication'
  name: string
  applicationCategory: string
  operatingSystem: string
  description: string
  offers: Offer
  aggregateRating: AggregateRating
  featureList: string[]
  screenshot: string
  softwareVersion: string
  author: Organization
}

interface OrganizationSchema {
  '@context': 'https://schema.org'
  '@type': 'Organization'
  name: string
  url: string
  logo: string
  description?: string
  foundingDate?: string
  founders?: Array<{
    '@type': 'Person'
    name: string
  }>
  address: {
    '@type': 'PostalAddress'
    streetAddress: string
    addressLocality: string
    addressRegion: string
    postalCode: string
    addressCountry: string
  }
  contactPoint: {
    '@type': 'ContactPoint'
    telephone: string
    contactType: string
    email: string
    areaServed?: string
    availableLanguage?: string[]
  }
  sameAs: string[]
}

export function JsonLd() {
  const structuredData: SoftwareApplication = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TruthSource',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'B2B e-commerce data synchronization platform that prevents costly order errors by syncing inventory, pricing, and customer data across NetSuite, Shopify, and more.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: '0',
        priceCurrency: 'USD',
        eligibleQuantity: {
          '@type': 'QuantitativeValue',
          value: '14',
          unitText: 'DAY',
        },
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '127',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      'Real-time inventory synchronization',
      'Dynamic pricing rules engine',
      'Customer self-service portal',
      'Analytics and reporting',
      'Multi-platform integration',
      'API access',
    ],
    screenshot: 'https://truthsource.io/images/dashboard-preview.png',
    softwareVersion: '2.0',
    author: {
      '@type': 'Organization',
      name: 'TruthSource Inc.',
      url: 'https://truthsource.io',
    },
  }

  const organizationData: OrganizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TruthSource',
    url: 'https://truthsource.io',
    logo: 'https://truthsource.io/logo.png',
    sameAs: [
      'https://twitter.com/truthsource',
      'https://linkedin.com/company/truthsource',
      'https://github.com/truthsource',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-415-555-0123',
      contactType: 'sales',
      email: 'sales@truthsource.io',
      areaServed: 'US',
      availableLanguage: ['English'],
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: '123 Market Street, Suite 100',
      addressLocality: 'San Francisco',
      addressRegion: 'CA',
      postalCode: '94105',
      addressCountry: 'US',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
      />
    </>
  )
}
