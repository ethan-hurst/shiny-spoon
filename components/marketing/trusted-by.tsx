export function TrustedBy() {
  const companies = [
    { name: 'NetSuite' },
    { name: 'Shopify' },
    { name: 'SAP' },
    { name: 'Microsoft' },
    { name: 'QuickBooks' },
    { name: 'WooCommerce' },
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
              className="h-12 w-32 relative flex items-center justify-center transition-all hover:opacity-100"
            >
              <span className="text-sm font-medium text-gray-600">
                {company.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
