import { ProductForm } from '@/components/features/products/product-form'

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold">Add New Product</h1>
        <p className="text-muted-foreground">
          Create a new product in your catalog
        </p>
      </div>

      <div className="max-w-2xl">
        <ProductForm />
      </div>
    </div>
  )
}
