import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  company: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  phone: z.string().optional(),
  subject: z.enum([
    'sales',
    'support',
    'demo',
    'partnership',
    'other'
  ]),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000),
})

export type ContactFormData = z.infer<typeof contactSchema>

export const subjectOptions = [
  { value: 'sales', label: 'Sales Inquiry' },
  { value: 'support', label: 'Technical Support' },
  { value: 'demo', label: 'Request a Demo' },
  { value: 'partnership', label: 'Partnership Opportunity' },
  { value: 'other', label: 'Other' },
]