import Image from 'next/image'

interface IntegrationLogosProps {
  category: 'inventory' | 'pricing' | 'customers' | 'all'
}

const integrations = {
  inventory: [
    { name: 'NetSuite' },
    { name: 'Shopify' },
    { name: 'SAP' },
    { name: 'WooCommerce' },
    { name: 'BigCommerce' },
    { name: 'Magento' },
  ],
  pricing: [
    { name: 'Stripe' },
    { name: 'QuickBooks' },
    { name: 'Salesforce' },
    { name: 'HubSpot' },
  ],
  customers: [
    { name: 'Salesforce' },
    { name: 'HubSpot' },
    { name: 'Zendesk' },
    { name: 'Intercom' },
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
              className="h-12 w-32 relative flex items-center justify-center transition-all opacity-60 hover:opacity-100"
            >
              <span className="text-sm font-medium text-gray-600">
                {integration.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
