'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Dynamically import the RealtimeIndicator to reduce initial bundle size
// This component contains websocket/polling logic that isn't needed immediately
const RealtimeIndicator = dynamic(
  () =>
    import('./realtime-indicator').then((mod) => ({
      default: mod.RealtimeIndicator,
    })),
  {
    loading: () => <Skeleton className="h-8 w-8 rounded-full" />,
    ssr: false, // Disable SSR since this component relies on browser APIs
  }
)

export function RealtimeIndicatorWrapper() {
  return <RealtimeIndicator />
}
