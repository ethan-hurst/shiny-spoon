import { z } from 'zod'

export const productSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(50, 'SKU must be less than 50 characters')
    .regex(
      /^[A-Za-z0-9-_]+$/,
      'SKU can only contain letters, numbers, hyphens, and underscores'
    ),
  name: z
    .string()
    .min(1, 'Product name is required')
    .max(200, 'Name must be less than 200 characters'),
  description: z.string().max(1000).optional(),
  category: z.string().optional(),
  base_price: z
    .string()
    .regex(/^$|^\d+(\.\d{1,2})?$/, 'Invalid price format')
    .transform((val) => (val === '' ? 0 : parseFloat(val))),
  cost: z
    .string()
    .regex(/^$|^\d+(\.\d{1,2})?$/, 'Invalid cost format')
    .transform((val) => (val === '' ? 0 : parseFloat(val)))
    .optional(),
  weight: z
    .string()
    .optional()
    .refine(
      (val) => val === '' || val === undefined || /^\d+(\.\d{1,3})?$/.test(val),
      {
        message: 'Invalid weight format',
      }
    )
    .transform((val) =>
      val === '' || val === undefined ? undefined : parseFloat(val)
    ),
  image: z
    .instanceof(File)
    .refine((file) => {
      if (!file) return true
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ]
      return allowedTypes.includes(file.type)
    }, 'Only JPEG, PNG, and WebP image formats are allowed')
    .optional()
    .or(z.string().optional()),
})

export const bulkProductSchema = z.object({
  products: z
    .array(
      z.object({
        sku: z.string(),
        name: z.string(),
        description: z.string().optional(),
        category: z.string().optional(),
        base_price: z.number(),
        cost: z.number().optional(),
        weight: z.number().optional(),
      })
    )
    .max(5000, 'Maximum 5000 products per import'),
})
