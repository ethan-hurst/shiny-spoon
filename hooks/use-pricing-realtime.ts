'use client'

import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { PricingRuleRecord } from '@/types/pricing.types'

export function usePricingRealtime(enabled: boolean = true) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Handle pricing rule changes
  const handleRuleChange = useCallback(
    (payload: any) => {
      const eventType = payload.eventType
      const rule = payload.new as PricingRuleRecord
      const oldRule = payload.old as PricingRuleRecord

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] })
      queryClient.invalidateQueries({ queryKey: ['price-calculations'] })

      // Clear pricing cache when rules change
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.delete('pricing-cache')
      }

      // Show notification
      switch (eventType) {
        case 'INSERT':
          toast.info(`New pricing rule created: ${rule.name}`, {
            description: 'Prices will be recalculated automatically',
          })
          break
        case 'UPDATE':
          if (oldRule.is_active !== rule.is_active) {
            toast.info(
              `Pricing rule ${rule.is_active ? 'activated' : 'deactivated'}: ${rule.name}`,
              {
                description: 'Prices will be recalculated automatically',
              }
            )
          } else {
            toast.info(`Pricing rule updated: ${rule.name}`, {
              description: 'Prices will be recalculated automatically',
            })
          }
          break
        case 'DELETE':
          toast.info(`Pricing rule deleted: ${oldRule.name}`, {
            description: 'Prices will be recalculated automatically',
          })
          break
      }
    },
    [queryClient]
  )

  // Handle product pricing changes
  const handlePricingChange = useCallback(
    (payload: any) => {
      const eventType = payload.eventType
      const pricing = payload.new

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['product-pricing'] })
      queryClient.invalidateQueries({ queryKey: ['price-calculations'] })

      // Clear pricing cache
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.delete('pricing-cache')
      }

      // Show notification
      toast.info('Product pricing updated', {
        description: 'Prices will be recalculated automatically',
      })
    },
    [queryClient]
  )

  // Handle customer pricing changes
  const handleCustomerPricingChange = useCallback(
    (payload: any) => {
      const eventType = payload.eventType
      const pricing = payload.new

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['customer-pricing'] })
      queryClient.invalidateQueries({ queryKey: ['price-calculations'] })

      // Clear pricing cache
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.delete('pricing-cache')
      }

      // Show notification
      toast.info('Customer pricing updated', {
        description: 'Prices will be recalculated automatically',
      })
    },
    [queryClient]
  )

  useEffect(() => {
    if (!enabled) return

    // Get current user's organization
    let organizationId: string | null = null
    const getOrganization = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('organization_id')
          .eq('user_id', user.id)
          .single()

        organizationId = profile?.organization_id || null
      }
    }

    getOrganization()

    // Subscribe to pricing rule changes
    const rulesChannel = supabase
      .channel('pricing-rules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pricing_rules',
          filter: organizationId
            ? `organization_id=eq.${organizationId}`
            : undefined,
        },
        handleRuleChange
      )
      .subscribe()

    // Subscribe to product pricing changes
    const pricingChannel = supabase
      .channel('product-pricing-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_pricing',
          filter: organizationId
            ? `organization_id=eq.${organizationId}`
            : undefined,
        },
        handlePricingChange
      )
      .subscribe()

    // Subscribe to customer pricing changes
    const customerPricingChannel = supabase
      .channel('customer-pricing-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_pricing',
          filter: organizationId
            ? `organization_id=eq.${organizationId}`
            : undefined,
        },
        handleCustomerPricingChange
      )
      .subscribe()

    // Cleanup
    return () => {
      supabase.removeChannel(rulesChannel)
      supabase.removeChannel(pricingChannel)
      supabase.removeChannel(customerPricingChannel)
    }
  }, [
    enabled,
    supabase,
    handleRuleChange,
    handlePricingChange,
    handleCustomerPricingChange,
  ])
}

// Hook to subscribe to specific product price changes
export function useProductPriceRealtime(
  productId: string | undefined,
  enabled: boolean = true
) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled || !productId) return

    const channel = supabase
      .channel(`product-price-${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_calculations',
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          // Invalidate price queries for this product
          queryClient.invalidateQueries({
            queryKey: ['product-price', productId],
          })

          // Show notification if price changed significantly
          const calculation = payload.new
          if (calculation && calculation.discount_percent > 20) {
            toast.success('Price updated with significant discount', {
              description: `${calculation.discount_percent.toFixed(1)}% discount applied`,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, productId, supabase, queryClient])
}

// Hook for price calculation notifications
export function usePriceCalculationNotifications(enabled: boolean = true) {
  const supabase = createClient()

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel('price-calculation-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'price_calculations',
        },
        async (payload) => {
          const calculation = payload.new

          // Check for low margin warnings
          if (calculation.margin_percent && calculation.margin_percent < 15) {
            // Fetch product details
            const { data: product } = await supabase
              .from('products')
              .select('name, sku')
              .eq('id', calculation.product_id)
              .single()

            if (product) {
              toast.warning('Low margin warning', {
                description: `${product.name} (${product.sku}) has a margin of ${calculation.margin_percent.toFixed(1)}%`,
                duration: 10000,
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, supabase])
}
