'use client'

import { usePricingRealtime, usePriceCalculationNotifications } from '@/hooks/use-pricing-realtime'

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enable real-time pricing updates
  usePricingRealtime()
  usePriceCalculationNotifications()

  return <>{children}</>
}