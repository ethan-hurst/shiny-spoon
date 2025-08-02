import { Suspense } from 'react'
import { DashboardSidebar } from '@/components/layouts/dashboard-sidebar'
import { DashboardHeader } from '@/components/layouts/dashboard-header'
import { DashboardSkeleton } from '@/components/layouts/dashboard-skeleton'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            <Suspense fallback={<DashboardSkeleton />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

