'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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

const reasonColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
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

export function AdjustmentHistory({ inventoryId, organizationId }: AdjustmentHistoryProps) {
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchAdjustments = async () => {
      try {
        const { data, error } = await supabase
          .from('inventory_adjustments')
          .select(`
            *,
            user:created_by (
              id,
              email
            )
          `)
          .eq('inventory_id', inventoryId)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error

        // Map the data to include user information
        const adjustmentsWithUser = data?.map((adj: any) => ({
          ...adj,
          user: {
            full_name: adj.user?.email?.split('@')[0] || 'Unknown',
            email: adj.user?.email || 'unknown@example.com'
          }
        })) || []

        setAdjustments(adjustmentsWithUser as InventoryAdjustment[])
      } catch (error) {
        console.error('Error fetching adjustment history:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAdjustments()

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
        async (payload: any) => {
          // Fetch the new adjustment with user data
          const { data } = await supabase
            .from('inventory_adjustments')
            .select(`
              *,
              user:created_by (
                id,
                email
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            const newAdjustment = {
              ...data,
              user: {
                full_name: data.user?.email?.split('@')[0] || 'Unknown',
                email: data.user?.email || 'unknown@example.com'
              }
            }
            setAdjustments(prev => [newAdjustment as InventoryAdjustment, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [inventoryId, organizationId, supabase])

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

  if (adjustments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No adjustments found for this item.</p>
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
                <TableCell className="max-w-[150px] truncate" title={adjustment.user.email}>
                  {adjustment.user.full_name}
                </TableCell>
                <TableCell>{adjustment.previous_quantity}</TableCell>
                <TableCell>{adjustment.new_quantity}</TableCell>
                <TableCell>
                  <span className={adjustment.adjustment > 0 ? 'text-green-600' : adjustment.adjustment < 0 ? 'text-red-600' : ''}>
                    {adjustment.adjustment > 0 ? '+' : ''}{adjustment.adjustment}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={reasonColors[adjustment.reason] || 'default'}>
                    {reasonLabels[adjustment.reason] || adjustment.reason}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={adjustment.notes || ''}>
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