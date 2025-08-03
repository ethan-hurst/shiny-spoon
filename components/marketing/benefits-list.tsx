import {
  BarChart,
  Lock,
  LucideIcon,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react'
import { Card } from '@/components/ui/card'

const iconMap: Record<string, LucideIcon> = {
  'shield-check': ShieldCheck,
  warehouse: Warehouse,
  refresh: RefreshCw,
  'trending-up': TrendingUp,
  users: Users,
  zap: Zap,
  'bar-chart': BarChart,
  lock: Lock,
}

interface Benefit {
  title: string
  description: string
  icon: string
}

interface BenefitsListProps {
  benefits: Benefit[]
}

export function BenefitsList({ benefits }: BenefitsListProps) {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Key Benefits</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transform your B2B operations with these powerful features
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit) => {
            const Icon = iconMap[benefit.icon] || ShieldCheck
            return (
              <Card key={benefit.title} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-gray-600">{benefit.description}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
