import { Check, X } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function ComparisonTable() {
  const features = [
    {
      feature: 'Real-time sync',
      truthSource: true,
      manual: false,
      competitors: 'Limited',
    },
    {
      feature: 'Multi-location inventory',
      truthSource: true,
      manual: false,
      competitors: true,
    },
    {
      feature: 'Automatic conflict resolution',
      truthSource: true,
      manual: false,
      competitors: false,
    },
    {
      feature: 'Custom field mapping',
      truthSource: true,
      manual: false,
      competitors: true,
    },
    {
      feature: 'Bulk operations',
      truthSource: true,
      manual: true,
      competitors: true,
    },
    {
      feature: 'API access',
      truthSource: true,
      manual: false,
      competitors: true,
    },
    {
      feature: 'Setup time',
      truthSource: '15 min',
      manual: 'N/A',
      competitors: '2-4 weeks',
    },
    {
      feature: 'Support',
      truthSource: '24/7',
      manual: 'N/A',
      competitors: 'Business hours',
    },
  ]

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Why choose TruthSource?</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how we compare to manual processes and other solutions
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-semibold">Feature</th>
                  <th className="text-center p-4 font-semibold text-primary">
                    TruthSource
                  </th>
                  <th className="text-center p-4 font-semibold">
                    Manual Process
                  </th>
                  <th className="text-center p-4 font-semibold">
                    Other Solutions
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((row, index) => (
                  <tr
                    key={row.feature}
                    className={index % 2 === 0 ? 'bg-gray-50/50' : ''}
                  >
                    <td className="p-4 font-medium">{row.feature}</td>
                    <td className="p-4 text-center">
                      {typeof row.truthSource === 'boolean' ? (
                        row.truthSource ? (
                          <Check
                            className="h-5 w-5 text-green-500 mx-auto"
                            aria-label="True"
                          />
                        ) : (
                          <X
                            className="h-5 w-5 text-red-500 mx-auto"
                            aria-label="False"
                          />
                        )
                      ) : (
                        <span className="text-primary font-semibold">
                          {row.truthSource}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {typeof row.manual === 'boolean' ? (
                        row.manual ? (
                          <Check
                            className="h-5 w-5 text-green-500 mx-auto"
                            aria-label="True"
                          />
                        ) : (
                          <X
                            className="h-5 w-5 text-red-500 mx-auto"
                            aria-label="False"
                          />
                        )
                      ) : (
                        <span className="text-gray-600">{row.manual}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {typeof row.competitors === 'boolean' ? (
                        row.competitors ? (
                          <Check
                            className="h-5 w-5 text-green-500 mx-auto"
                            aria-label="True"
                          />
                        ) : (
                          <X
                            className="h-5 w-5 text-red-500 mx-auto"
                            aria-label="False"
                          />
                        )
                      ) : (
                        <span className="text-gray-600">{row.competitors}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  )
}
