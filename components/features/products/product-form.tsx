'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { isFile } from '@/lib/utils/file'
import { productSchema } from '@/lib/validations/product'
import { createProduct, updateProduct } from '@/app/actions/products'
import { Product } from '@/types/product.types'
import { CategorySelect } from './category-select'
import { ImageUpload } from './image-upload'

interface ProductFormProps {
  product?: Product
}

/**
 * Renders a form for creating or editing a product, handling validation, image upload, and submission.
 *
 * If a product is provided, the form is prefilled for editing; otherwise, it is set up for creating a new product. On submission, the form data is validated and sent to the appropriate API endpoint. Displays success or error messages based on the result and navigates to the products dashboard upon success.
 *
 * @param product - Optional product data to prefill the form for editing
 */
export function ProductForm({ product }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  type FormData = z.input<typeof productSchema>

  const form = useForm<FormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: product?.sku || '',
      name: product?.name || '',
      description: product?.description || '',
      category: product?.category || '',
      base_price: product?.base_price?.toString() || '',
      cost: product?.cost?.toString() || '',
      weight: product?.weight?.toString() || '',
      image: product?.image_url || undefined,
    },
  })

  async function onSubmit(values: FormData) {
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (isFile(value)) {
            formData.append(key, value)
          } else {
            formData.append(key, value.toString())
          }
        }
      })

      let result
      if (product) {
        formData.append('id', product.id)
        result = await updateProduct(formData)
      } else {
        result = await createProduct(formData)
      }

      if (result?.error) {
        if (typeof result.error === 'string') {
          toast.error(result.error)
        } else if (result.error?.fieldErrors) {
          // Handle validation errors more efficiently
          const fieldErrors = result.error.fieldErrors
          const errorMessages = Object.entries(fieldErrors)
            .map(
              ([field, errors]) =>
                `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`
            )
            .join('; ')
          toast.error(`Validation errors: ${errorMessages}`)
        } else if (result.error?.message) {
          // Handle API errors with specific messages
          toast.error(result.error.message)
        } else {
          toast.error(
            'Failed to save product. Please check your input and try again.'
          )
        }
      } else {
        toast.success(
          product
            ? 'Product updated successfully'
            : 'Product created successfully'
        )
        router.push('/dashboard/products')
        router.refresh()
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={!!product}
                    placeholder="WIDGET-001"
                  />
                </FormControl>
                <FormDescription>
                  Stock Keeping Unit - unique identifier for this product
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Premium Widget" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Enter product description..."
                  className="resize-none"
                  rows={4}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <CategorySelect
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (lbs)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    step="0.001"
                    placeholder="0.00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="base_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Price ($)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                  />
                </FormControl>
                <FormDescription>Customer selling price</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost ($)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                  />
                </FormControl>
                <FormDescription>Your cost to purchase/produce</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Image</FormLabel>
              <FormControl>
                <ImageUpload
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : product
                ? 'Update Product'
                : 'Create Product'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/products')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
