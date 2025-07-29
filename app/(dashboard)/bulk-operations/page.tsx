import { Suspense } from 'react'
import { BulkOperationsDashboard } from '@/components/features/bulk/bulk-operations-dashboard'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Renders the Bulk Operations page with a header and asynchronously loaded dashboard content.
 *
 * Displays a loading skeleton while the dashboard is being fetched or rendered.
 */
export default function BulkOperationsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Bulk Operations</h2>
      </div>
      
      <Suspense fallback={<BulkOperationsLoading />}>
        <BulkOperationsDashboard />
      </Suspense>
    </div>
  )
}

/**
 * Displays a skeleton UI representing the loading state for the bulk operations page.
 *
 * Shows placeholder elements for the header, active operations section, and operations history to indicate content is loading.
 */
function BulkOperationsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Active operations skeleton */}
      <Card>
        <div className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Operations history skeleton */}
      <Card>
        <div className="p-6">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-64 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}