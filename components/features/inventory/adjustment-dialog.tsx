'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  adjustmentSchema, 
  ADJUSTMENT_REASON_LABELS,
  type InventoryWithRelations,
  calculateAvailableQuantity
} from '@/types/inventory.types'
import { adjustInventory } from '@/app/actions/inventory'
import { Loader2, Package, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface AdjustmentDialogProps {
  inventory: InventoryWithRelations
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type AdjustmentFormData = z.infer<typeof adjustmentSchema>

export function AdjustmentDialog({
  inventory,
  open,
  onOpenChange,
  onSuccess
}: AdjustmentDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      inventory_id: inventory.id,
      new_quantity: inventory.quantity || 0,
      reason: 'cycle_count',
      notes: '',
    },
  })

  // Reset form when dialog opens with new inventory
  React.useEffect(() => {
    if (open) {
      form.reset({
        inventory_id: inventory.id,
        new_quantity: inventory.quantity || 0,
        reason: 'cycle_count',
        notes: '',
      })
    }
  }, [open, inventory, form])

  const currentQuantity = inventory.quantity || 0
  const reservedQuantity = inventory.reserved_quantity || 0
  const availableQuantity = calculateAvailableQuantity(inventory)
  const newQuantity = form.watch('new_quantity')
  const adjustment = newQuantity - currentQuantity

  async function onSubmit(data: AdjustmentFormData) {
    setIsSubmitting(true)
    
    try {
      const formData = new FormData()
      formData.append('inventory_id', data.inventory_id)
      formData.append('new_quantity', data.new_quantity.toString())
      formData.append('reason', data.reason)
      if (data.notes) {
        formData.append('notes', data.notes)
      }

      const result = await adjustInventory(formData)

      if (result?.error) {
        toast({
          title: 'Error',
          description: typeof result.error === 'string' 
            ? result.error 
            : 'Failed to adjust inventory',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Success',
          description: 'Inventory adjusted successfully',
        })
        onSuccess()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Inventory</DialogTitle>
          <DialogDescription>
            Update the quantity for {inventory.product.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">SKU</span>
              <Badge variant="outline">{inventory.product.sku}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Warehouse</span>
              <Badge variant="secondary">{inventory.warehouse.name}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Quantity</span>
              <span className="font-medium">{currentQuantity.toLocaleString()}</span>
            </div>
            {reservedQuantity > 0 && (
              <>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-sm">Reserved</span>
                  <span className="text-sm">{reservedQuantity.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Available</span>
                  <span className="font-medium">{availableQuantity.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="new_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Quantity</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        max="999999"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the new total quantity for this item
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Adjustment Preview */}
              {adjustment !== 0 && (
                <Alert>
                  <Package className="h-4 w-4" />
                  <AlertDescription>
                    Adjustment: {adjustment > 0 ? '+' : ''}{adjustment.toLocaleString()} units
                  </AlertDescription>
                </Alert>
              )}

              {/* Warning for reducing below reserved */}
              {newQuantity < reservedQuantity && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Warning: New quantity is below reserved quantity ({reservedQuantity.toLocaleString()})
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Adjustment</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ADJUSTMENT_REASON_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Required for audit trail
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ''}
                        placeholder="Add any additional details..."
                        className="resize-none"
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Any additional context for this adjustment
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || adjustment === 0}
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Inventory
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}