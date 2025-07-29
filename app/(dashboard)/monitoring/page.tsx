import { Metadata } from 'next'
import { MonitoringDashboard } from '@/components/features/monitoring/monitoring-dashboard'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export const metadata: Metadata = {
  title: 'System Monitoring - TruthSource',
  description: 'Real-time system health and performance monitoring',
}

export default function MonitoringPage() {
  return (
    <div className="container mx-auto py-6">
      <ErrorBoundary>
        <MonitoringDashboard />
      </ErrorBoundary>
    </div>
  )
}