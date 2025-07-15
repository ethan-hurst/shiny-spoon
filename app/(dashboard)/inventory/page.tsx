import { createClient } from '@/lib/supabase/server'
import { InventoryTable } from '@/components/features/inventory/inventory-table'
import { InventoryStats } from '@/components/features/inventory/inventory-stats'
import { InventoryFilters } from '@/components/features/inventory/inventory-filters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import type { InventoryWithRelations, InventoryStats as IInventoryStats } from '@/types/inventory.types'

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { warehouse_id?: string; search?: string; low_stock?: string }
}) {
  const supabase = createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/onboarding')
  }

  // Build inventory query
  let inventoryQuery = supabase
    .from('inventory')
    .select(`
      *,
      product:products!inner(*),
      warehouse:warehouses!inner(*)
    `)
    .eq('organization_id', profile.organization_id)
    .order('updated_at', { ascending: false })

  // Apply filters
  if (searchParams.warehouse_id) {
    inventoryQuery = inventoryQuery.eq('warehouse_id', searchParams.warehouse_id)
  }

  if (searchParams.search) {
    inventoryQuery = inventoryQuery.or(
      `product.name.ilike.%${searchParams.search}%,product.sku.ilike.%${searchParams.search}%`
    )
  }

  if (searchParams.low_stock === 'true') {
    // This is a simplified version - in production, you'd want a database function
    inventoryQuery = inventoryQuery.lte('quantity', 'reorder_point')
  }

  // Fetch inventory data
  const { data: inventory, error } = await inventoryQuery

  if (error) {
    console.error('Error fetching inventory:', error)
    throw new Error('Failed to load inventory')
  }

  // Fetch warehouses for filters
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .order('name')

  // Calculate stats
  const stats: IInventoryStats = {
    total_items: inventory?.length || 0,
    total_value: inventory?.reduce((sum: number, item: any) => {
      const price = item.product?.price || 0
      const quantity = item.quantity || 0
      return sum + (price * quantity)
    }, 0) || 0,
    low_stock_items: inventory?.filter((item: any) => {
      const available = (item.quantity || 0) - (item.reserved_quantity || 0)
      return available <= (item.reorder_point || 0) && available > 0
    }).length || 0,
    out_of_stock_items: inventory?.filter((item: any) => {
      const available = (item.quantity || 0) - (item.reserved_quantity || 0)
      return available <= 0
    }).length || 0,
  }

  // Transform to InventoryWithRelations type
  const inventoryWithRelations: InventoryWithRelations[] = (inventory || []).map(item => ({
    ...item,
    product: item.product as any,
    warehouse: item.warehouse as any,
  }))

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <p className="text-muted-foreground">
          Track inventory levels across all warehouses and manage stock adjustments
        </p>
      </div>

      {/* Stats Cards */}
      <InventoryStats stats={stats} />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryFilters 
            warehouses={warehouses || []} 
            currentFilters={{
              warehouse_id: searchParams.warehouse_id,
              search: searchParams.search,
              low_stock_only: searchParams.low_stock === 'true'
            }}
          />
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryTable 
            initialData={inventoryWithRelations}
            organizationId={profile.organization_id}
          />
        </CardContent>
      </Card>
    </div>
  )
}