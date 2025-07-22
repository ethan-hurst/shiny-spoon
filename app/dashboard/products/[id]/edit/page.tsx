import { notFound } from 'next/navigation'
import { ProductForm } from '@/components/features/products/product-form'
import { createClient } from '@/lib/supabase/server'

interface EditProductPageProps {
  params: {
    id: string
  }
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const supabase = createClient()

  // Get current user and organization
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Fetch product
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (error || !product) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <p className="text-muted-foreground">Update product information</p>
      </div>

      <div className="max-w-2xl">
        <ProductForm product={product} />
      </div>
    </div>
  )
}
