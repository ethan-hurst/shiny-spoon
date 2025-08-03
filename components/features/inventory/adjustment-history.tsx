'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import type { InventoryAdjustment as BaseInventoryAdjustment } from '@/types/inventory.types'

interface InventoryAdjustment extends BaseInventoryAdjustment {
  user: {
    full_name: string
    email: string
  }
}

interface AdjustmentHistoryProps {
  inventoryId: string
  organizationId: string
}

const reasonLabels: Record<string, string> = {
  sale: 'Sale',
  return: 'Return',
  damage: 'Damage',
  theft: 'Theft',
  found: 'Found',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  cycle_count: 'Cycle Count',
  other: 'Other',
}

const reasonColors: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  sale: 'default',
  return: 'secondary',
  damage: 'destructive',
  theft: 'destructive',
  found: 'secondary',
  transfer_in: 'secondary',
  transfer_out: 'outline',
  cycle_count: 'default',
  other: 'default',
}

// Query function for fetching adjustments
async function fetchAdjustments(inventoryId: string, organizationId: string) {
  const supabase = createClient()

  // Use the view that includes user details
  const { data, error } = await supabase
    .from('inventory_adjustments_with_user')
    .select('*')
    .eq('inventory_id', inventoryId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  // Map the data to match our interface
  const adjustmentsWithUser =
    data?.map((adj: any) => ({
      ...adj,
      user: {
        full_name:
          adj.user_full_name || adj.user_email?.split('@')[0] || 'Unknown',
        email: adj.user_email || 'unknown@example.com',
      },
    })) || []

  return adjustmentsWithUser as InventoryAdjustment[]
}

export function AdjustmentHistory({
  inventoryId,
  organizationId,
}: AdjustmentHistoryProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Use React Query for data fetching
  const {
    data: adjustments = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['inventory-adjustments', inventoryId, organizationId],
    queryFn: () => fetchAdjustments(inventoryId, organizationId),
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    // Set up real-time subscription
    const channel = supabase
      .channel(`adjustments-${inventoryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_adjustments',
          filter: `inventory_id=eq.${inventoryId}`,
        },
        () => {
          // Invalidate and refetch the query when new adjustments are added
          queryClient.invalidateQueries({
            queryKey: ['inventory-adjustments', inventoryId, organizationId],
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [inventoryId, organizationId, supabase, queryClient])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load adjustment history. Please try again later.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (adjustments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No adjustments found for this item.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adjustment History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Previous Qty</TableHead>
              <TableHead>New Qty</TableHead>
              <TableHead>Adjustment</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.map((adjustment) => (
              <TableRow key={adjustment.id}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(adjustment.created_at), 'MMM d, yyyy HH:mm')}
                </TableCell>
                <TableCell
                  className="max-w-[150px] truncate"
                  title={adjustment.user.email}
                >
                  {adjustment.user.full_name}
                </TableCell>
                <TableCell>{adjustment.previous_quantity}</TableCell>
                <TableCell>{adjustment.new_quantity}</TableCell>
                <TableCell>
                  <span
                    className={
                      adjustment.adjustment > 0
                        ? 'text-green-600'
                        : adjustment.adjustment < 0
                          ? 'text-red-600'
                          : ''
                    }
                  >
                    {adjustment.adjustment > 0 ? '+' : ''}
                    {adjustment.adjustment}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={reasonColors[adjustment.reason] || 'default'}>
                    {reasonLabels[adjustment.reason] || adjustment.reason}
                  </Badge>
                </TableCell>
                <TableCell
                  className="max-w-[200px] truncate"
                  title={adjustment.notes || ''}
                >
                  {adjustment.notes || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
