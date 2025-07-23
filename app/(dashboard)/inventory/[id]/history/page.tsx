import Link from 'next/link'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Calendar, FileText, Package, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import {
  ADJUSTMENT_REASON_COLORS,
  ADJUSTMENT_REASON_LABELS,
} from '@/types/inventory.types'
import type {
  AdjustmentReason,
  InventoryAdjustment,
} from '@/types/inventory.types'

// Interface for raw adjustment data from database
interface RawAdjustmentData {
  id: string
  inventory_id: string
  organization_id: string
  previous_quantity: number
  new_quantity: number
  adjustment: number
  reason: AdjustmentReason
  notes: string | null
  created_at: string
  created_by: string
  user_full_name: string | null
  user_email: string
}

export default async function InventoryHistoryPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/onboarding')
  }

  // Fetch inventory item details
  const { data: inventory, error: inventoryError } = await supabase
    .from('inventory')
    .select(
      `
      *,
      product:products!inner(*),
      warehouse:warehouses!inner(*)
    `
    )
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (inventoryError || !inventory) {
    redirect('/inventory')
  }

  // Fetch adjustment history
  const { data: adjustments, error: adjustmentsError } = await supabase
    .from('inventory_adjustments_with_user')
    .select('*')
    .eq('inventory_id', params.id)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (adjustmentsError) {
    console.error('Error fetching adjustments:', adjustmentsError)
  }

  const adjustmentHistory: InventoryAdjustment[] = (adjustments || []).map(
    (adj: any) => ({
      id: adj.id,
      inventory_id: adj.inventory_id,
      organization_id: adj.organization_id,
      previous_quantity: adj.previous_quantity,
      new_quantity: adj.new_quantity,
      adjustment: adj.adjustment,
      reason: adj.reason as AdjustmentReason,
      notes: adj.notes,
      created_at: adj.created_at,
      created_by: adj.created_by,
      user_full_name: adj.user_full_name || undefined,
      user_email: adj.user_email,
    })
  )

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Inventory History</h1>
          <p className="text-muted-foreground">
            Adjustment history for {inventory.product.name}
          </p>
        </div>
      </div>

      {/* Product Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">SKU</p>
              <p className="font-medium">{inventory.product.sku}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Product Name</p>
              <p className="font-medium">{inventory.product.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Warehouse</p>
              <p className="font-medium">{inventory.warehouse.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Quantity</p>
              <p className="font-medium text-lg">{inventory.quantity}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjustment History */}
      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
          <CardDescription>
            All quantity changes for this inventory item
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adjustmentHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No adjustments have been made to this inventory item
            </div>
          ) : (
            <div className="space-y-4">
              {adjustmentHistory.map((adjustment) => (
                <div
                  key={adjustment.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  {/* Adjustment Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            ADJUSTMENT_REASON_COLORS[adjustment.reason]
                          }
                        >
                          {ADJUSTMENT_REASON_LABELS[adjustment.reason]}
                        </Badge>
                        <span
                          className={`font-medium ${
                            adjustment.adjustment > 0
                              ? 'text-green-600'
                              : adjustment.adjustment < 0
                                ? 'text-red-600'
                                : 'text-gray-600'
                          }`}
                        >
                          {adjustment.adjustment > 0 ? '+' : ''}
                          {adjustment.adjustment} units
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {adjustment.user_full_name || adjustment.user_email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(
                            new Date(adjustment.created_at),
                            'MMM d, yyyy h:mm a'
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Quantity Change
                      </p>
                      <p className="font-medium">
                        {adjustment.previous_quantity} →{' '}
                        {adjustment.new_quantity}
                      </p>
                    </div>
                  </div>

                  {/* Notes */}
                  {adjustment.notes && (
                    <div className="pt-2 border-t">
                      <div className="flex items-start gap-2">
                        <FileText className="h-3 w-3 text-muted-foreground mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          {adjustment.notes}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
