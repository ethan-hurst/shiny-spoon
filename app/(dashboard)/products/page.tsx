import { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'
import { BulkImportDialog } from '@/components/features/products/bulk-import-dialog'
import { ProductsTable } from '@/components/features/products/products-table'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
// import { generateProductCSVTemplate } from '@/lib/csv/product-import'
import { Product } from '@/types/product.types'

interface InventoryItem {
  quantity: number
  reserved_quantity: number
}

interface ProductWithInventory extends Product {
  inventory?: InventoryItem[]
}

export const metadata: Metadata = {
  title: 'Products',
  description: 'Manage your product catalog',
}

export default async function ProductsPage() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Unauthorized</div>
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    return <div>User profile not found</div>
  }

  // Fetch products with inventory stats
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      inventory:inventory!left(
        quantity,
        reserved_quantity
      )
    `
    )
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  const products = data as ProductWithInventory[] | null

  if (error) {
    console.error('Error fetching products:', error)
    return <div>Error loading products</div>
  }

  // Transform products to include stats
  const productsWithStats =
    products?.map((product: ProductWithInventory) => {
      const inventoryItems = product.inventory || []
      const totalQuantity = inventoryItems.reduce(
        (sum: number, item: InventoryItem) => sum + (item.quantity || 0),
        0
      )
      const totalReserved = inventoryItems.reduce(
        (sum: number, item: InventoryItem) =>
          sum + (item.reserved_quantity || 0),
        0
      )
      const availableQuantity = totalQuantity - totalReserved

      return {
        ...product,
        inventory_count: inventoryItems.length,
        total_quantity: totalQuantity,
        available_quantity: availableQuantity,
        low_stock: totalQuantity < 10, // Simple low stock logic
      }
    }) || []

  // Get unique categories for filter
  const rawCategories =
    products
      ?.map((p) => p.category)
      .filter((c): c is string => typeof c === 'string' && c.length > 0) || []

  const categories = Array.from(new Set(rawCategories)).sort()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BulkImportDialog>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </BulkImportDialog>
          <Button size="sm" asChild>
            <Link href="/dashboard/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      <ProductsTable initialData={productsWithStats} categories={categories} />
    </div>
  )
}
