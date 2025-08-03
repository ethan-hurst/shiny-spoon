import { Shield, Target, Users, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'

const values = [
  {
    icon: Target,
    title: 'Accuracy First',
    description:
      'We obsess over data accuracy because we know every error costs our customers money.',
  },
  {
    icon: Users,
    title: 'Customer Success',
    description:
      'Your success is our success. We go above and beyond to ensure you achieve your goals.',
  },
  {
    icon: Zap,
    title: 'Speed Matters',
    description:
      'In B2B, every second counts. We build for performance and reliability at scale.',
  },
  {
    icon: Shield,
    title: 'Trust & Security',
    description:
      'We handle your business data with bank-level security and complete transparency.',
  },
]

export function CompanyValues() {
  return (
    <section className="py-12">
      <h2 className="text-2xl font-bold mb-8 text-center">Our Values</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {values.map((value) => (
          <Card key={value.title} className="p-6 text-center">
            <div className="inline-flex p-3 rounded-full bg-primary/10 mb-4">
              <value.icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">{value.title}</h3>
            <p className="text-sm text-gray-600">{value.description}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}
