import Image from 'next/image'

interface IntegrationLogosProps {
  category: 'inventory' | 'pricing' | 'customers' | 'all'
}

const integrations = {
  inventory: [
    { name: 'NetSuite', logo: '/logos/netsuite.svg' },
    { name: 'Shopify', logo: '/logos/shopify.svg' },
    { name: 'SAP', logo: '/logos/sap.svg' },
    { name: 'WooCommerce', logo: '/logos/woocommerce.svg' },
    { name: 'BigCommerce', logo: '/logos/bigcommerce.svg' },
    { name: 'Magento', logo: '/logos/magento.svg' },
  ],
  pricing: [
    { name: 'Stripe', logo: '/logos/stripe.svg' },
    { name: 'QuickBooks', logo: '/logos/quickbooks.svg' },
    { name: 'Salesforce', logo: '/logos/salesforce.svg' },
    { name: 'HubSpot', logo: '/logos/hubspot.svg' },
  ],
  customers: [
    { name: 'Salesforce', logo: '/logos/salesforce.svg' },
    { name: 'HubSpot', logo: '/logos/hubspot.svg' },
    { name: 'Zendesk', logo: '/logos/zendesk.svg' },
    { name: 'Intercom', logo: '/logos/intercom.svg' },
  ],
}

export function IntegrationLogos({ category }: IntegrationLogosProps) {
  const logos =
    category === 'all'
      ? [
          ...integrations.inventory,
          ...integrations.pricing,
          ...integrations.customers,
        ]
      : integrations[category] || []

  const uniqueLogos = Array.from(
    new Map(logos.map((item) => [item.name, item])).values()
  )
  const headingId = 'integration-logos-heading'
  const descriptionId = 'integration-logos-description'

  return (
    <section
      className="py-16 bg-gray-50"
      aria-label="Integration partners and supported platforms"
      aria-describedby={`${headingId} ${descriptionId}`}
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h3 id={headingId} className="text-2xl font-bold mb-2">
            Seamless Integrations
          </h3>
          <p id={descriptionId} className="text-gray-600">
            Connect with the tools you already use
          </p>
        </div>
        <div
          className="flex flex-wrap justify-center items-center gap-8 md:gap-12"
          role="list"
          aria-label="List of integrated platforms"
        >
          {uniqueLogos.map((integration) => (
            <div
              key={integration.name}
              role="listitem"
              className="h-12 w-32 relative grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
            >
              <Image
                src={integration.logo}
                alt={`${integration.name} integration`}
                className="h-full w-full object-contain"
                width={128}
                height={48}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
