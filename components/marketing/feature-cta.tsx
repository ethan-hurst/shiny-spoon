import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FeatureCTA() {
  return (
    <section className="py-16 bg-primary text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to eliminate data errors?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of B2B companies already using TruthSource to keep
            their data accurate.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
                <Calendar className="mr-2 h-4 w-4" />
                Schedule a Demo
              </Button>
            </Link>
          </div>

          <p className="mt-6 text-sm opacity-75">
            No credit card required • 14-day free trial • Setup in 15 minutes
          </p>
        </div>
      </div>
    </section>
  )
}
