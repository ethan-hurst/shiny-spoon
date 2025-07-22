import { redirect } from 'next/navigation'
import { InventoryTableOptimistic } from '@/components/features/inventory/inventory-table-optimistic'
import { PerformanceWidget } from '@/components/features/inventory/performance-widget'
import { PresenceDisplay } from '@/components/features/inventory/presence-display'
import { createServerClient } from '@/lib/supabase/server'

export default async function RealtimeDemoPage() {
  const supabase = createServerClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/login')
  }

  // Fetch initial inventory data
  const { data: inventory, error } = await supabase
    .from('inventory')
    .select(
      `
      *,
      product:products!inner (
        id,
        name,
        sku,
        description
      ),
      warehouse:warehouses!inner (
        id,
        name,
        location
      )
    `
    )
    .eq('organization_id', profile.organization_id)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching inventory:', error)
    return <div>Error loading inventory</div>
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Real-time Inventory Demo</h1>
          <p className="text-muted-foreground mt-2">
            Experience all the real-time features: optimistic updates, offline
            sync, presence, and performance monitoring
          </p>
        </div>
        <PresenceDisplay organizationId={profile.organization_id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <InventoryTableOptimistic
            initialData={inventory || []}
            organizationId={profile.organization_id}
          />
        </div>

        <div className="space-y-4">
          <PerformanceWidget />

          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-sm">Testing Tips</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Open in multiple tabs to see presence</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Go offline in DevTools to test offline queue</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Make simultaneous edits to test conflict resolution</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Watch the performance metrics as you interact</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
