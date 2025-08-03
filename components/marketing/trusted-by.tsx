export function TrustedBy() {
  const companies = [
    { name: 'NetSuite', logo: '/logos/netsuite.svg' },
    { name: 'Shopify', logo: '/logos/shopify.svg' },
    { name: 'SAP', logo: '/logos/sap.svg' },
    { name: 'Microsoft', logo: '/logos/microsoft.svg' },
    { name: 'QuickBooks', logo: '/logos/quickbooks.svg' },
    { name: 'WooCommerce', logo: '/logos/woocommerce.svg' },
  ]

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wider">
            Trusted by leading B2B companies
          </p>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60">
          {companies.map((company) => (
            <div
              key={company.name}
              className="h-12 w-32 relative grayscale hover:grayscale-0 transition-all"
            >
              <img
                src={company.logo}
                alt={`${company.name} logo`}
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
