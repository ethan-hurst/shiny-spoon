// components/features/audit/audit-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton'

export function AuditSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-10 w-[200px]" />
        <Skeleton className="h-10 w-[150px]" />
        <Skeleton className="h-10 w-[150px]" />
      </div>

      {/* Table skeleton */}
      <div className="border rounded-md">
        <div className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[150px]" />
                </div>
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[80px]" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}