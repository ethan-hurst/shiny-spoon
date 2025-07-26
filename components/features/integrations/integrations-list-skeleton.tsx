import { Skeleton } from '@/components/ui/skeleton'

interface IntegrationsListSkeletonProps {
  count?: number
}

export function IntegrationsListSkeleton({ count = 5 }: IntegrationsListSkeletonProps = {}) {
  return (
    <div className="divide-y">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}