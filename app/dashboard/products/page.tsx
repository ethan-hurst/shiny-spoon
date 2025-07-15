import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ProductsTable } from '@/components/features/products/products-table'

export default async function ProductsPage() {
  const supabase = createClient()
  
  // Get current user and organization
  const { data: { user } } = await supabase.auth.getUser()
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

  // Fetch products with inventory stats
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      *,
      inventory (
        quantity,
        reserved_quantity
      )
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Failed to load products')
  }

  // Transform data to include stats
  const productsWithStats = products?.map(product => {
    const totalQuantity = product.inventory?.reduce((sum: number, inv: any) => 
      sum + (inv.quantity || 0), 0) || 0
    const totalReserved = product.inventory?.reduce((sum: number, inv: any) => 
      sum + (inv.reserved_quantity || 0), 0) || 0
    
    // Get low stock threshold (configurable per organization)
    const lowStockThreshold = product.reorder_point || 10 // Use reorder_point or default to 10
    
    return {
      ...product,
      inventory_count: product.inventory?.length || 0,
      total_quantity: totalQuantity,
      available_quantity: totalQuantity - totalReserved,
      low_stock: totalQuantity < lowStockThreshold
    }
  }) || []

  // Get unique categories for filter
  const categories = [...new Set(products?.map(p => p.category).filter(Boolean))] as string[]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and inventory
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>

      <ProductsTable 
        initialData={productsWithStats}
        categories={categories}
      />
    </div>
  )
}