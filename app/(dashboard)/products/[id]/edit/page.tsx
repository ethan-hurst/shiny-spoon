import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/features/products/product-form'

export const metadata: Metadata = {
  title: 'Edit Product',
  description: 'Edit product details',
}

interface EditProductPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Server component for the "Edit Product" page that handles authentication, authorization, and product retrieval.
 *
 * Awaits route parameters and initializes a Supabase client. Redirects unauthenticated users or users without a profile to the login page. Fetches the specified product for the authenticated user's organization; if not found, triggers a 404 response. Renders a form pre-filled with the product's data for editing.
 *
 * @param props - Contains a promise resolving to route parameters with the product ID.
 * @returns The JSX for the edit product page, or redirects/not found responses as appropriate.
 */
export default async function EditProductPage(props: EditProductPageProps) {
  const params = await props.params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
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
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
        <p className="text-muted-foreground">
          Update product information for {product.name}
        </p>
      </div>

      <div className="max-w-3xl">
        <ProductForm product={product} />
      </div>
    </div>
  )
}