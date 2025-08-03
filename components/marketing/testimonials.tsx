'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { Card } from '@/components/ui/card'

const testimonials = [
  {
    quote:
      'TruthSource eliminated our inventory sync issues overnight. We went from 33% order errors to less than 0.1% in just two weeks.',
    author: 'Sarah Chen',
    role: 'VP of Operations',
    company: 'Industrial Supply Co.',
    rating: 5,
    metric: '99.9% accuracy',
  },
  {
    quote:
      'The real-time pricing sync has been a game-changer. Our sales team can now quote confidently knowing the prices are always current.',
    author: 'Michael Rodriguez',
    role: 'Director of Sales',
    company: 'TechParts Distribution',
    rating: 5,
    metric: '$400K saved/year',
  },
  {
    quote:
      'Setup was incredibly easy. We had our NetSuite and Shopify B2B stores synced within 30 minutes. The support team is phenomenal.',
    author: 'Emily Thompson',
    role: 'IT Manager',
    company: 'Global Components Ltd.',
    rating: 5,
    metric: '30 min setup',
  },
]

export function Testimonials() {
  return (
    <section className="py-20 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Trusted by B2B leaders worldwide
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how companies are saving hundreds of thousands per year by
            eliminating data errors.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.article
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              aria-label={`Testimonial from ${testimonial.author} at ${testimonial.company}`}
            >
              <Card className="h-full p-6 flex flex-col">
                <div
                  className="flex gap-1 mb-4"
                  aria-label={`${testimonial.rating} out of 5 stars`}
                >
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>

                <blockquote className="flex-1 mb-6">
                  <p className="text-gray-700 italic">"{testimonial.quote}"</p>
                </blockquote>

                <footer className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <cite className="font-semibold not-italic">
                        {testimonial.author}
                      </cite>
                      <p className="text-sm text-gray-600">
                        {testimonial.role}
                      </p>
                      <p className="text-sm text-gray-600">
                        {testimonial.company}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {testimonial.metric}
                      </p>
                    </div>
                  </div>
                </footer>
              </Card>
            </motion.article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-lg text-gray-600">
            Join <span className="font-semibold">500+ companies</span> already
            using TruthSource
          </p>
        </div>
      </div>
    </section>
  )
}
