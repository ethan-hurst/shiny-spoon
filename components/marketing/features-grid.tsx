import Link from 'next/link'
import {
  BarChart3,
  Clock,
  Package,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Card } from '@/components/ui/card'

const features = [
  {
    title: 'Real-time Inventory Sync',
    description:
      'Keep stock levels accurate across all channels with instant updates. Prevent overselling and stockouts.',
    icon: Package,
    href: '/features/inventory-sync',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    title: 'Dynamic Pricing Rules',
    description:
      'Set customer-specific pricing, volume discounts, and promotional rules that sync everywhere.',
    icon: TrendingUp,
    href: '/features/pricing-rules',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    title: 'Customer Portal',
    description:
      'Give customers self-service access to orders, invoices, and real-time inventory availability.',
    icon: Users,
    href: '/features/customer-portal',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    title: 'Analytics Dashboard',
    description:
      'Track sync performance, identify discrepancies, and monitor data accuracy across systems.',
    icon: BarChart3,
    href: '/features/analytics',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    title: 'Automated Reconciliation',
    description:
      'Automatically detect and resolve data conflicts between systems with smart algorithms.',
    icon: RefreshCw,
    href: '/features/reconciliation',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    title: 'Enterprise Security',
    description:
      'Bank-level encryption, SOC 2 compliance, and role-based access control for your peace of mind.',
    icon: Shield,
    href: '/features/security',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
]

export function FeaturesGrid() {
  return (
    <section className="py-20 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Everything you need for B2B data accuracy
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Stop losing money to data errors. TruthSource keeps your inventory,
            pricing, and customer data synchronized across all platforms.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <Card className="h-full p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                <div
                  className={`inline-flex p-3 rounded-lg ${feature.bgColor} mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-4 p-4 bg-primary/5 rounded-lg">
            <Zap className="h-6 w-6 text-primary" />
            <div className="text-left">
              <p className="font-semibold">Lightning fast performance</p>
              <p className="text-sm text-gray-600">
                Sub-200ms sync times with 99.9% uptime SLA
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
