import { z } from 'zod'

export const productSchema = z.object({
  sku: z.string()
    .min(1, 'SKU is required')
    .max(50, 'SKU must be less than 50 characters')
    .regex(/^[A-Za-z0-9-_]+$/, 'SKU can only contain letters, numbers, hyphens, and underscores'),
  name: z.string()
    .min(1, 'Product name is required')
    .max(200, 'Name must be less than 200 characters'),
  description: z.string().max(1000).optional(),
  category: z.string().optional(),
  base_price: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format')
    .transform((val) => parseFloat(val)),
  cost: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid cost format')
    .transform((val) => parseFloat(val))
    .optional(),
  weight: z.string()
    .regex(/^\d+(\.\d{1,3})?$/, 'Invalid weight format')
    .transform((val) => parseFloat(val))
    .optional(),
  image: z.instanceof(File).optional().or(z.string().optional()),
})

export const bulkProductSchema = z.object({
  products: z.array(z.object({
    sku: z.string(),
    name: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    base_price: z.number(),
    cost: z.number().optional(),
    weight: z.number().optional(),
  })).max(5000, 'Maximum 5000 products per import')
})