import Link from 'next/link'
import { Plus } from 'lucide-react'
import { WarehousesTable } from '@/components/features/warehouses/warehouses-table'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { Address } from '@/types/warehouse.types'

export default async function WarehousesPage() {
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

  // Fetch warehouses with inventory counts
  const { data: warehouses, error } = await supabase
    .from('warehouses')
    .select(
      `
      *,
      inventory:inventory(count)
    `
    )
    .eq('organization_id', profile.organization_id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Failed to load warehouses')
  }

  // Transform data to include inventory count
  const warehousesWithCounts =
    warehouses?.map((warehouse) => ({
      ...warehouse,
      inventory_count: warehouse.inventory?.[0]?.count || 0,
    })) || []

  // Get unique states for filter
  const states = Array.from(
    new Set(
      warehouses
        ?.map((w) => {
          const address = w.address as Address
          return address?.state
        })
        .filter(Boolean)
    )
  ) as string[]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Warehouses</h1>
          <p className="text-muted-foreground">
            Manage your warehouse locations and inventory storage
          </p>
        </div>
        <Button asChild>
          <Link href="/warehouses/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Warehouse
          </Link>
        </Button>
      </div>

      <WarehousesTable initialData={warehousesWithCounts} states={states} />
    </div>
  )
}
