'use client'

import { motion } from 'framer-motion'
import CountUp from 'react-countup'

const stats = [
  { value: 500, suffix: '+', label: 'Companies Trust Us' },
  { value: 99.9, suffix: '%', label: 'Uptime SLA', decimals: 1 },
  { value: 2.5, prefix: '$', suffix: 'M+', label: 'Errors Prevented', decimals: 1 },
  { value: 200, suffix: 'ms', label: 'Avg Sync Time' },
]

export function CompanyStats() {
  return (
    <section className="py-12 bg-gray-50 rounded-lg">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="text-3xl lg:text-4xl font-bold text-primary mb-2">
              {stat.prefix}
              <CountUp
                end={stat.value}
                decimals={stat.decimals || 0}
                duration={2}
                enableScrollSpy
                scrollSpyOnce
              />
              {stat.suffix}
            </div>
            <p className="text-gray-600">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}