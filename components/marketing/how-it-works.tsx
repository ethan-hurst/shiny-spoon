'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plug, Cog, Zap, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const steps = [
  {
    number: '01',
    title: 'Connect Your Systems',
    description: 'Link NetSuite, Shopify, and other platforms with our secure OAuth integration. No coding required.',
    icon: Plug,
  },
  {
    number: '02',
    title: 'Configure Sync Rules',
    description: 'Set up field mappings, sync frequency, and business rules through our intuitive interface.',
    icon: Cog,
  },
  {
    number: '03',
    title: 'Start Syncing',
    description: 'TruthSource begins synchronizing your data in real-time, keeping everything accurate across all systems.',
    icon: Zap,
  },
  {
    number: '04',
    title: 'Monitor & Optimize',
    description: 'Track sync performance, resolve conflicts, and ensure data accuracy with our monitoring dashboard.',
    icon: CheckCircle2,
  },
]

export function HowItWorks() {
  return (
    <section className="py-20 lg:py-32 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Get started in minutes, not months
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Our streamlined setup process gets you up and running quickly, with full support every step of the way.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connection line for desktop */}
          <div className="hidden lg:block absolute top-20 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center relative z-10">
                    <step.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {step.number}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-lg text-gray-600 mb-6">
            Average setup time: <span className="font-semibold text-gray-900">15 minutes</span>
          </p>
          <Link href="/signup">
            <Button size="lg">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}