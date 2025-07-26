import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface UseCustomerPricingRealtimeProps {
  customerId: string
  enabled?: boolean
}

export function useCustomerPricingRealtime({
  customerId,
  enabled = true,
}: UseCustomerPricingRealtimeProps) {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled || !customerId) return

    let channel: RealtimeChannel

    const setupRealtimeSubscription = async () => {
      // Subscribe to customer pricing changes
      channel = supabase
        .channel(`customer-pricing-${customerId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'customer_pricing',
            filter: `customer_id=eq.${customerId}`,
          },
          (_payload: any) => {
            // Invalidate customer pricing queries
            queryClient.invalidateQueries({
              queryKey: ['customer-pricing', customerId],
            })
            queryClient.invalidateQueries({
              queryKey: ['customer-prices', customerId],
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'customer_contracts',
            filter: `customer_id=eq.${customerId}`,
          },
          (_payload: any) => {
            // Invalidate contract queries
            queryClient.invalidateQueries({
              queryKey: ['customer-contracts', customerId],
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'price_approvals',
            filter: `customer_id=eq.${customerId}`,
          },
          (_payload: any) => {
            // Invalidate approval queries
            queryClient.invalidateQueries({
              queryKey: ['price-approvals', customerId],
            })
            queryClient.invalidateQueries({
              queryKey: ['pending-approvals'],
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'customer_price_history',
            filter: `customer_id=eq.${customerId}`,
          },
          (_payload: any) => {
            // Invalidate price history queries
            queryClient.invalidateQueries({
              queryKey: ['price-history', customerId],
            })
          }
        )
        .subscribe()
    }

    setupRealtimeSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [customerId, enabled, supabase, queryClient])
}

// Hook for contract expiry notifications
export function useContractExpiryNotifications({
  customerId,
  enabled = true,
}: UseCustomerPricingRealtimeProps) {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled || !customerId) return

    const checkExpiring = async () => {
      // Check for contracts expiring in the next 30 days
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      const { data: expiringContracts } = await supabase
        .from('customer_contracts')
        .select('*')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .lte('end_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0])

      if (expiringContracts && expiringContracts.length > 0) {
        // Trigger proper notification instead of console.log
        // This could emit an event, update state, or call a notification service
        queryClient.setQueryData(['contract-expiry-notifications', customerId], {
          count: expiringContracts.length,
          contracts: expiringContracts,
        })
      }
    }

    // Check on mount
    checkExpiring()

    // Check daily
    const interval = setInterval(checkExpiring, 24 * 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [customerId, enabled])
}

// Hook for approval notifications
export function usePriceApprovalNotifications(organizationId?: string) {
  const queryClient = useQueryClient()
  const supabase = createBrowserClient()

  useEffect(() => {
    if (!organizationId) return

    const channel = supabase
      .channel('price-approval-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'price_approvals',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: any) => {
          // Invalidate approval queries
          queryClient.invalidateQueries({
            queryKey: ['pending-approvals'],
          })
          
          // You could show a toast notification here
          console.log('New price approval request', payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [organizationId, supabase, queryClient])
}