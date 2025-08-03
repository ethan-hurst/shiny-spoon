'use client'

import { useState } from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

const newsletterSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type NewsletterFormData = z.infer<typeof newsletterSchema>

export default function Footer() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createBrowserClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
  })

  const onSubmit = async (data: NewsletterFormData) => {
    setIsSubmitting(true)

    try {
      // Store newsletter subscription in database
      const { error } = await supabase.from('newsletter_subscribers').insert({
        email: data.email,
        subscribed_at: new Date().toISOString(),
        status: 'active',
        source: 'footer',
      })

      if (error) {
        // Check if email already exists
        if (error.code === '23505') {
          toast.error('You are already subscribed to our newsletter!')
        } else {
          toast.error('Failed to subscribe. Please try again.')
          console.error('Newsletter subscription error:', error)
        }
        return
      }

      toast.success('Successfully subscribed to our newsletter!')
      reset()

      // Track the subscription event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'newsletter_signup', {
          event_category: 'engagement',
          event_label: 'footer',
        })
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  return (
    <footer className="border-t dark:bg-black">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2">
          <div className="border-b   py-8 lg:order-last lg:border-b-0 lg:border-s lg:py-16 lg:ps-16">
            <div className="mt-8 space-y-4 lg:mt-0">
              <div>
                <h3 className="text-2xl font-medium">
                  Stay Updated with TruthSource
                </h3>
                <p className="mt-4 max-w-lg  ">
                  Get the latest updates on B2B e-commerce trends, platform
                  features, and integration tips delivered to your inbox.
                </p>
              </div>
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col border rounded-xl p-4 gap-3 mt-6 w-full"
              >
                <Input
                  {...register('email')}
                  placeholder="Enter your email"
                  type="email"
                  disabled={isSubmitting}
                  aria-label="Email address for newsletter"
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Subscribing...' : 'Subscribe'}
                </Button>
              </form>
            </div>
          </div>

          <div className="py-8 lg:py-16 lg:pe-16">
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <p className="font-medium ">Connect</p>

                <ul className="mt-6 space-y-4 text-sm">
                  <li>
                    <Link
                      href="https://twitter.com/truthsource"
                      target="_blank"
                      className="transition hover:opacity-75"
                    >
                      Twitter
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="https://linkedin.com/company/truthsource"
                      target="_blank"
                      className="  transition hover:opacity-75"
                    >
                      LinkedIn
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="https://github.com/truthsource"
                      target="_blank"
                      className="  transition hover:opacity-75"
                    >
                      GitHub
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-medium ">Resources</p>

                <ul className="mt-6 space-y-4 text-sm">
                  <li>
                    <Link
                      href="/docs"
                      className="  transition hover:opacity-75"
                    >
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/help"
                      className="  transition hover:opacity-75"
                    >
                      Help Center
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/blog"
                      className="  transition hover:opacity-75"
                    >
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/developers"
                      className="  transition hover:opacity-75"
                    >
                      API Reference
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t   pt-8">
              <ul className="flex flex-wrap gap-4 text-xs">
                <li>
                  <Link
                    href="/legal/terms"
                    className="transition hover:opacity-75"
                  >
                    Terms & Conditions
                  </Link>
                </li>

                <li>
                  <Link
                    href="/legal/privacy"
                    className="transition hover:opacity-75"
                  >
                    Privacy Policy
                  </Link>
                </li>

                <li>
                  <Link
                    href="/legal/cookies"
                    className="transition hover:opacity-75"
                  >
                    Cookie Policy
                  </Link>
                </li>
              </ul>

              <p className="mt-8 text-xs  ">
                &copy; {new Date().getFullYear()} TruthSource Inc. All rights
                reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
