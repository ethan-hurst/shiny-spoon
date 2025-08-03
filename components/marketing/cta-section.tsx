import Link from 'next/link'
import { ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CTASection() {
  return (
    <section className="py-20 lg:py-32 bg-primary text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Stop losing money to data errors
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of B2B companies that trust TruthSource to keep their
            data accurate across all systems.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="group">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent text-white border-white hover:bg-white hover:text-primary"
              >
                Talk to Sales
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span>Cancel anytime</span>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/20">
            <p className="text-sm opacity-75 mb-4">
              Trusted by industry leaders
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              <span className="text-lg font-semibold">NetSuite</span>
              <span className="text-lg font-semibold">Shopify Plus</span>
              <span className="text-lg font-semibold">SAP</span>
              <span className="text-lg font-semibold">Microsoft</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
