'use client'

import { motion } from 'framer-motion'

export function CompanyStory() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="py-12"
    >
      <div className="prose prose-lg max-w-none">
        <h2 className="text-2xl font-bold mb-6">Our Story</h2>

        <p className="text-gray-600 mb-4">
          TruthSource was born from frustration. As VP of Operations at a $100M
          B2B distributor, our founder Sarah Chen watched her team waste
          countless hours every day fixing data errors between NetSuite and
          their e-commerce platforms.
        </p>

        <p className="text-gray-600 mb-4">
          "We were losing $400,000 per year to overselling, pricing errors, and
          order mistakes," Sarah recalls. "Our sales team couldn't trust the
          inventory data, customers received wrong prices, and we spent more
          time fixing errors than growing the business."
        </p>

        <p className="text-gray-600 mb-4">
          After trying every integration tool on the market and finding them
          either too complex or too limited for B2B needs, Sarah partnered with
          enterprise software veterans to build the solution that B2B companies
          actually need.
        </p>

        <p className="text-gray-600 mb-6">
          Today, TruthSource helps hundreds of distributors, manufacturers, and
          B2B retailers eliminate data errors and focus on what matters: serving
          their customers and growing their business.
        </p>

        <blockquote className="border-l-4 border-primary pl-6 italic text-gray-700">
          "We built TruthSource to be the single source of truth for B2B data.
          No more spreadsheets, no more manual updates, no more costly errors.
          Just accurate data, everywhere it needs to be."
          <footer className="text-sm mt-2">
            — Sarah Chen, CEO & Co-founder
          </footer>
        </blockquote>
      </div>
    </motion.section>
  )
}
