import { Metadata } from 'next'
import { ProductForm } from '@/components/features/products/product-form'

export const metadata: Metadata = {
  title: 'Add Product',
  description: 'Add a new product to your catalog',
}

export default function NewProductPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Product</h1>
        <p className="text-muted-foreground">
          Add a new product to your catalog
        </p>
      </div>

      <div className="max-w-3xl">
        <ProductForm />
      </div>
    </div>
  )
}
