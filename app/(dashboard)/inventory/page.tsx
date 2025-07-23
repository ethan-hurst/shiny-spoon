import { redirect } from 'next/navigation'
import { InventoryFilters } from '@/components/features/inventory/inventory-filters'
import { InventoryStats } from '@/components/features/inventory/inventory-stats'
import { InventoryTable } from '@/components/features/inventory/inventory-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import type {
  InventoryStats as IInventoryStats,
  InventoryWithRelations,
} from '@/types/inventory.types'

interface InventoryQueryResult {
  id: string
  organization_id: string
  quantity: number
  reserved_quantity: number
  reorder_point: number
  product: {
    id: string
    name: string
    sku: string
    price: number
  }
  warehouse: {
    id: string
    name: string
    code: string
  }
}

interface UserProfileResult {
  organization_id: string
}

interface WarehouseResult {
  id: string
  name: string
  code: string
}

export default async function InventoryPage(props: {
  searchParams: Promise<{ warehouse_id?: string; search?: string; low_stock?: string }>
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/onboarding')
  }

  const organizationId = (profile as UserProfileResult).organization_id

  // Build inventory query
  let inventoryQuery = supabase
    .from('inventory')
    .select(
      `
      *,
      product:products!inner(*),
      warehouse:warehouses!inner(*)
    `
    )
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })

  // Apply filters
  if (searchParams.warehouse_id) {
    inventoryQuery = inventoryQuery.eq(
      'warehouse_id',
      searchParams.warehouse_id
    )
  }

  if (searchParams.search) {
    inventoryQuery = inventoryQuery.or(
      `product.name.ilike.%${searchParams.search}%,product.sku.ilike.%${searchParams.search}%`
    )
  }

  if (searchParams.low_stock === 'true') {
    // Filter for low stock items using client-side logic until database view is deployed
    // TODO: Once database migration is deployed, use: inventoryQuery = inventoryQuery.eq('is_low_stock', true)
  }

  // Fetch inventory data
  const { data: inventoryData, error } = await inventoryQuery

  if (error) {
    console.error('Error fetching inventory:', error)
    throw new Error('Failed to load inventory')
  }

  const inventory = (inventoryData as unknown as InventoryQueryResult[]) || []

  // Fetch warehouses for filters
  const { data: warehouseData } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name')

  const warehouses = (warehouseData as unknown as WarehouseResult[]) || []

  // Calculate stats
  const stats: IInventoryStats = {
    total_items: inventory.length,
    total_value: inventory.reduce((sum: number, item: InventoryQueryResult) => {
      const price = item.product?.price || 0
      const quantity = item.quantity || 0
      return sum + price * quantity
    }, 0),
    low_stock_items: inventory.filter((item: InventoryQueryResult) => {
      const available = (item.quantity || 0) - (item.reserved_quantity || 0)
      return available <= (item.reorder_point || 0) && available > 0
    }).length,
    out_of_stock_items: inventory.filter((item: InventoryQueryResult) => {
      const available = (item.quantity || 0) - (item.reserved_quantity || 0)
      return available <= 0
    }).length,
  }

  // Apply client-side low stock filtering if requested
  let filteredInventory = inventory
  if (searchParams.low_stock === 'true') {
    filteredInventory = inventory.filter((item: InventoryQueryResult) => {
      const available = (item.quantity || 0) - (item.reserved_quantity || 0)
      return available <= (item.reorder_point || 0)
    })
  }

  // Transform to InventoryWithRelations type
  const inventoryWithRelations: InventoryWithRelations[] =
    filteredInventory.map(
      (item) =>
        ({
          ...item,
          product_id: item.product.id,
          warehouse_id: item.warehouse.id,
          reorder_quantity: 0, // Default value, should be in database
          last_counted_at: null, // Default value, should be in database
          last_counted_by: null, // Default value, should be in database
          created_at: new Date().toISOString(), // Default value, should be in database
          updated_at: new Date().toISOString(), // Default value, should be in database
          product: item.product,
          warehouse: item.warehouse,
        }) as unknown as InventoryWithRelations
    )

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">
              Track inventory levels across all warehouses and manage stock
              adjustments
            </p>
          </div>
          <a
            href="/dashboard/inventory/realtime-demo"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Try Real-time Demo
          </a>
        </div>
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
              warehouse_id: searchParams.warehouse_id || undefined,
              search: searchParams.search || undefined,
              low_stock_only: searchParams.low_stock === 'true',
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
            organizationId={organizationId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
