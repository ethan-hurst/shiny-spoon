'use client'

import { Loader2 } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ContactFormData, subjectOptions } from '@/lib/schemas/contact'

interface ContactFormProps {
  form: UseFormReturn<ContactFormData>
  onSubmit: (data: ContactFormData) => void
  loading: boolean
}

export function ContactForm({ form, onSubmit, loading }: ContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = form

  const subject = watch('subject')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="John Doe"
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && (
            <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="john@company.com"
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (
            <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="company">Company *</Label>
          <Input
            id="company"
            {...register('company')}
            placeholder="Acme Corp"
            className={errors.company ? 'border-red-500' : ''}
          />
          {errors.company && (
            <p className="text-sm text-red-500 mt-1">
              {errors.company.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Phone (Optional)</Label>
          <Input
            id="phone"
            type="tel"
            {...register('phone')}
            placeholder="+1 (555) 123-4567"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="subject">Subject *</Label>
        <Select
          value={subject}
          onValueChange={(value) =>
            setValue('subject', value as ContactFormData['subject'])
          }
        >
          <SelectTrigger className={errors.subject ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
            {subjectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.subject && (
          <p className="text-sm text-red-500 mt-1">{errors.subject.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="message">Message *</Label>
        <Textarea
          id="message"
          {...register('message')}
          placeholder="Tell us how we can help..."
          rows={5}
          className={errors.message ? 'border-red-500' : ''}
        />
        {errors.message && (
          <p className="text-sm text-red-500 mt-1">{errors.message.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          'Send Message'
        )}
      </Button>

      <p className="text-xs text-gray-500 text-center">
        By submitting this form, you agree to our{' '}
        <a href="/legal/privacy" className="underline">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  )
}
