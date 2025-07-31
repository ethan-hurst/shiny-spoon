import { z } from 'zod'

export const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State/Province is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required').default('USA'),
})

export const contactSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  role: z.string().min(1, 'Role is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  isPrimary: z.boolean().default(false),
})

export const warehouseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Warehouse name is required')
    .max(100, 'Name must be less than 100 characters'),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code must be less than 20 characters')
    .regex(
      /^[A-Za-z0-9-\s]+$/,
      'Code must be letters, numbers, hyphens, and spaces only'
    )
    .transform((val) => val.toUpperCase()),
  address: addressSchema,
  contacts: z
    .array(contactSchema)
    .min(1, 'At least one contact is required')
    .refine(
      (contacts) => contacts.filter((c) => c.isPrimary).length === 1,
      'Exactly one contact must be marked as primary'
    ),
  is_default: z.boolean().default(false),
  active: z.boolean().default(true),
})
