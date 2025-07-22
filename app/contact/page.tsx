'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { ContactForm } from '@/components/forms/contact-form'
import { ContactInfo } from '@/components/company/contact-info'
import { contactSchema, type ContactFormData } from '@/lib/schemas/contact'
import PageWrapper from '@/components/wrapper/page-wrapper'

export default function ContactPage() {
  const [loading, setLoading] = useState(false)

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      subject: 'sales',
    },
  })

  const onSubmit = async (data: ContactFormData) => {
    setLoading(true)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to send message')
      }

      toast.success('Message sent! We\'ll get back to you within 24 hours.')
      form.reset()
    } catch (error) {
      console.error('Contact form error:', error)
      toast.error('Failed to send message. Please try again or email us directly.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
            <p className="text-xl text-gray-600">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Send us a message</h2>
              <ContactForm form={form} onSubmit={onSubmit} loading={loading} />
            </Card>
            <ContactInfo />
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-600 mb-6">
              Can't find what you're looking for?{' '}
              <a href="/help" className="text-primary hover:underline">
                Check our Help Center
              </a>
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}