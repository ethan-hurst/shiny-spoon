'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createBrowserClient } from '@/lib/supabase/client'
import { Mail } from 'lucide-react'

const newsletterSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type NewsletterFormData = z.infer<typeof newsletterSchema>

export function NewsletterCTA() {
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
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert({
          email: data.email,
          status: 'active',
          source: 'blog',
        })
        
      if (error) {
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
          event_label: 'blog_cta',
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
    <Card className="mb-12">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">Stay Updated</CardTitle>
        <CardDescription>
          Get the latest insights on B2B e-commerce and data accuracy delivered to your inbox
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-3">
          <Input
            {...register('email')}
            placeholder="Enter your email"
            type="email"
            disabled={isSubmitting}
            className="flex-1"
            aria-label="Email address for newsletter"
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Subscribing...' : 'Subscribe'}
          </Button>
        </form>
        {errors.email && (
          <p className="mt-2 text-sm text-red-500">{errors.email.message}</p>
        )}
      </CardContent>
    </Card>
  )
}