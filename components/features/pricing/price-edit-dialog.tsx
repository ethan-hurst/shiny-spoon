'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  Calculator,
  DollarSign,
  History,
  Percent,
  TrendingDown,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  calculateDiscount,
  calculateMargin,
  validatePriceChange,
} from '@/types/customer-pricing.types'

const priceEditSchema = z
  .object({
    priceType: z.enum(['fixed', 'discount']),
    fixedPrice: z.number().min(0).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    reason: z.string().min(1, 'Please provide a reason for the price change'),
    effectiveDate: z.string().optional(),
    expiryDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (
        data.priceType === 'fixed' &&
        (data.fixedPrice === undefined || data.fixedPrice === null)
      ) {
        return false
      }
      if (
        data.priceType === 'discount' &&
        (data.discountPercent === undefined || data.discountPercent === null)
      ) {
        return false
      }
      return true
    },
    {
      message: 'Please enter a price or discount value',
      path: ['fixedPrice'],
    }
  )

interface PriceEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: {
    id: string
    sku: string
    name: string
    basePrice: number
    cost: number
    currentPrice?: number
    currentDiscount?: number
  }
  customerId: string
  onSave: (data: any) => Promise<void>
}

export function PriceEditDialog({
  open,
  onOpenChange,
  product,
  customerId,
  onSave,
}: PriceEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [approvalReason, setApprovalReason] = useState<string>('')

  const form = useForm<z.infer<typeof priceEditSchema>>({
    resolver: zodResolver(priceEditSchema),
    defaultValues: {
      priceType: product.currentPrice ? 'fixed' : 'discount',
      fixedPrice: product.currentPrice || product.basePrice,
      discountPercent: product.currentDiscount || 0,
      reason: '',
      effectiveDate: new Date().toISOString().split('T')[0],
    },
  })

  const watchPriceType = form.watch('priceType')
  const watchFixedPrice = form.watch('fixedPrice')
  const watchDiscountPercent = form.watch('discountPercent')

  // Calculate metrics
  const currentPrice =
    watchPriceType === 'fixed'
      ? watchFixedPrice || 0
      : product.basePrice * (1 - (watchDiscountPercent || 0) / 100)

  const discount = calculateDiscount(product.basePrice, currentPrice)
  const margin = calculateMargin(currentPrice, product.cost)

  // Check approval requirements
  useEffect(() => {
    const fetchApprovalRules = async () => {
      const { getApprovalRules } = await import('@/app/actions/pricing')
      const result = await getApprovalRules()
      
      if (result.success && result.data) {
        const validation = validatePriceChange(
          currentPrice,
          product.basePrice,
          product.cost,
          result.data
        )

        setRequiresApproval(validation.requiresApproval)
        setApprovalReason(validation.reason || '')
      }
    }

    fetchApprovalRules()
  }, [currentPrice, product.basePrice, product.cost])

  const onSubmit = async (values: z.infer<typeof priceEditSchema>) => {
    setLoading(true)
    try {
      await onSave({
        productId: product.id,
        customerId,
        ...values,
        requiresApproval,
        calculatedPrice: currentPrice,
        discount,
        margin,
      })

      if (requiresApproval) {
        toast.info('Price change submitted for approval')
      } else {
        toast.success('Price updated successfully')
      }

      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to update price')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Customer Price</DialogTitle>
          <DialogDescription>
            Set a custom price for {product.name} ({product.sku})
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Current Pricing Info */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Base Price</p>
                <p className="font-semibold">
                  {formatCurrency(product.basePrice)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cost</p>
                <p className="font-semibold">{formatCurrency(product.cost)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Price</p>
                <p className="font-semibold">
                  {formatCurrency(product.currentPrice || product.basePrice)}
                </p>
              </div>
            </div>

            <Separator />

            {/* Price Type Selection */}
            <FormField
              control={form.control}
              name="priceType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Pricing Method</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-row space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fixed" id="fixed" />
                        <label
                          htmlFor="fixed"
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <DollarSign className="h-4 w-4" />
                          Fixed Price
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="discount" id="discount" />
                        <label
                          htmlFor="discount"
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Percent className="h-4 w-4" />
                          Discount %
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Price Input */}
            {watchPriceType === 'fixed' ? (
              <FormField
                control={form.control}
                name="fixedPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fixed Price</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-9"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value))
                          }
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Enter the custom price for this customer
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="discountPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Percentage</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          className="pr-9"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value))
                          }
                        />
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Discount percentage off the base price
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Calculated Metrics */}
            <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">New Price</p>
                </div>
                <p className="text-lg font-semibold">
                  {formatCurrency(currentPrice)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Discount</p>
                </div>
                <p className="text-lg font-semibold">
                  {formatPercent(discount)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Margin</p>
                </div>
                <p
                  className={`text-lg font-semibold ${margin < 15 ? 'text-destructive' : ''}`}
                >
                  {formatPercent(margin)}
                </p>
              </div>
            </div>

            {/* Approval Warning */}
            {requiresApproval && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Approval Required</AlertTitle>
                <AlertDescription>
                  {approvalReason}. This price change will need to be approved
                  before taking effect.
                </AlertDescription>
              </Alert>
            )}

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Change</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain why this price change is needed..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This will be included in the approval request and audit
                    trail
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      When this price becomes active
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>Leave blank for no expiry</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? 'Saving...'
                  : requiresApproval
                    ? 'Submit for Approval'
                    : 'Save Price'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
