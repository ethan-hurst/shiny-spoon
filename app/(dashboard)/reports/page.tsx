// PRP-019: Custom Reports Builder - Reports Dashboard
import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Reports | TruthSource',
  description: 'Custom reports and scheduled reports',
}

// Loading skeleton for reports
function ReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-6 border rounded-lg space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function ReportsContent() {
  const supabase = await createClient()

  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  // TODO: This will be implemented in PRP-019
  // For now, show a placeholder with coming soon message
  const demoReports = [
    {
      id: '1',
      name: 'Inventory Status Report',
      description: 'Weekly inventory levels across all warehouses',
      schedule: 'Weekly',
      last_run: '2 days ago',
      status: 'active'
    },
    {
      id: '2',
      name: 'Sales Performance',
      description: 'Monthly sales performance by customer and product',
      schedule: 'Monthly',
      last_run: '1 week ago',
      status: 'active'
    },
    {
      id: '3',
      name: 'Price Change Log',
      description: 'Audit trail of all pricing changes',
      schedule: 'On-demand',
      last_run: 'Never',
      status: 'draft'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Create and manage custom reports with automated scheduling
          </p>
        </div>
        <Button asChild>
          <Link href="/reports/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Report
          </Link>
        </Button>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900">Custom Reports Builder - Coming Soon</h3>
        <p className="text-blue-700 text-sm mt-1">
          This feature is part of PRP-019 and will include drag-and-drop report builder, 
          scheduled delivery, and multiple export formats.
        </p>
      </div>

      {/* Demo Reports Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {demoReports.map((report) => (
          <div key={report.id} className="p-6 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{report.name}</h3>
              <div className={`px-2 py-1 rounded-full text-xs ${
                report.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {report.status}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {report.description}
            </p>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 bg-gray-100 rounded">
                {report.schedule}
              </span>
              <span className="px-2 py-1 bg-gray-100 rounded">
                Last: {report.last_run}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Reports functionality will be available after PRP-019 implementation
        </p>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsPageSkeleton />}>
      <ReportsContent />
    </Suspense>
  )
}