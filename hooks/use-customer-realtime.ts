'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'

interface UseCustomerRealtimeOptions {
  customerId?: string
  organizationId: string
  enabled?: boolean
}

/**
 * Subscribes to real-time updates for customers, contacts, activities, and tiers within a specified organization, and optionally for a specific customer.
 *
 * Sets up Supabase real-time channels to listen for changes in customer-related tables. Automatically invalidates relevant React Query caches and displays toast notifications for updates, insertions, and deletions. Redirects to the customer list if a tracked customer is deleted.
 *
 * @param customerId - Optional ID of a specific customer to track for real-time updates
 * @param organizationId - ID of the organization whose customer data should be synchronized
 * @param enabled - Whether to enable the real-time subscription (default: true)
 */
export function useCustomerRealtime({
  customerId,
  organizationId,
  enabled = true,
}: UseCustomerRealtimeOptions) {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    if (!enabled || !organizationId) return

    // Subscribe to customer changes
    const customerChannel = supabase.channel(`customers-${organizationId}`).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'customers',
        filter: customerId
          ? `id=eq.${customerId}`
          : `organization_id=eq.${organizationId}`,
      },
      (payload: any) => {
        const { eventType } = payload

        // Handle specific customer updates
        if (customerId && payload.new?.id === customerId) {
          queryClient.invalidateQueries({ queryKey: ['customer', customerId] })

          if (eventType === 'UPDATE') {
            toast.info('Customer information has been updated')
          } else if (eventType === 'DELETE') {
            toast.warning('This customer has been deleted')
            router.push('/customers')
          }
        } else {
          // Handle list updates
          queryClient.invalidateQueries({ queryKey: ['customers'] })
        }
      }
    )

    // Subscribe to contact changes
    const contactChannel = supabase
      .channel(`contacts-${customerId || organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_contacts',
          filter: customerId ? `customer_id=eq.${customerId}` : undefined,
        },
        (payload: any) => {
          if (customerId) {
            queryClient.invalidateQueries({
              queryKey: ['customer-contacts', customerId],
            })

            const { eventType } = payload
            if (eventType === 'INSERT') {
              toast.success('New contact added')
            } else if (eventType === 'UPDATE') {
              toast.info('Contact updated')
            } else if (eventType === 'DELETE') {
              toast.info('Contact removed')
            }
          }
        }
      )

    // Subscribe to activity changes
    const activityChannel = supabase
      .channel(`activities-${customerId || organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_activities',
          filter: customerId
            ? `customer_id=eq.${customerId}`
            : `organization_id=eq.${organizationId}`,
        },
        () => {
          if (customerId) {
            queryClient.invalidateQueries({
              queryKey: ['customer-activities', customerId],
            })

            // Don't show toast for every activity, too noisy
            // Only invalidate queries to update the UI
          }
        }
      )

    // Subscribe to tier changes
    const tierChannel = supabase.channel(`tiers-${organizationId}`).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'customer_tiers',
        filter: `organization_id=eq.${organizationId}`,
      },
      (payload: any) => {
        queryClient.invalidateQueries({ queryKey: ['customer-tiers'] })

        const { eventType, new: newRecord } = payload
        if (eventType === 'INSERT') {
          toast.success(`New tier "${newRecord.name}" created`)
        } else if (eventType === 'UPDATE') {
          toast.info(`Tier "${newRecord.name}" updated`)
        } else if (eventType === 'DELETE') {
          toast.info('Tier deleted')
        }
      }
    )

    // Subscribe to all channels
    customerChannel.subscribe()
    contactChannel.subscribe()
    activityChannel.subscribe()
    tierChannel.subscribe()

    // Cleanup
    return () => {
      supabase.removeChannel(customerChannel)
      supabase.removeChannel(contactChannel)
      supabase.removeChannel(activityChannel)
      supabase.removeChannel(tierChannel)
    }
  }, [supabase, queryClient, router, customerId, organizationId, enabled])
}

// Hook for customer list real-time updates
export function useCustomerListRealtime(organizationId: string) {
  return useCustomerRealtime({ organizationId })
}

// Hook for specific customer real-time updates
export function useCustomerDetailRealtime(
  customerId: string,
  organizationId: string
) {
  return useCustomerRealtime({ customerId, organizationId })
}
