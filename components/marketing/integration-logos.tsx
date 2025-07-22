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
  const logos = category === 'all' 
    ? [...integrations.inventory, ...integrations.pricing, ...integrations.customers]
    : integrations[category] || []

  const uniqueLogos = Array.from(new Map(logos.map(item => [item.name, item])).values())

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold mb-2">Seamless Integrations</h3>
          <p className="text-gray-600">
            Connect with the tools you already use
          </p>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
          {uniqueLogos.map((integration) => (
            <div
              key={integration.name}
              className="h-12 w-32 relative grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
            >
              <img
                src={integration.logo}
                alt={`${integration.name} integration`}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}