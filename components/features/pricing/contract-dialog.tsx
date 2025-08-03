'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon, FileText, Plus, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { createBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { createContract, updateContract } from '@/app/actions/customer-pricing'
import { useProductsQuery } from '@/hooks/use-products-query'
import {
  contractSchema,
  ContractWithItems,
} from '@/types/customer-pricing.types'

interface ContractDialogProps {
  customerId: string
  contract?: ContractWithItems
  children?: React.ReactNode
}

interface ContractItemForm {
  product_id: string
  contract_price: number
  min_quantity: number
  max_quantity?: number
  price_locked: boolean
  notes?: string
}

// Inner component that uses the products data
function ContractDialogInner({
  customerId,
  contract,
  children,
}: ContractDialogProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  // Use React Query for products
  const { data: products = [], isError: productsError } = useProductsQuery()

  // Handle error state
  if (productsError) {
    toast.error('Failed to load products')
  }
  const [contractItems, setContractItems] = useState<ContractItemForm[]>([])

  const form = useForm<z.infer<typeof contractSchema>>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      customer_id: customerId,
      contract_number: contract?.contract_number || '',
      contract_name: contract?.contract_name || '',
      description: contract?.description || '',
      start_date: contract?.start_date || format(new Date(), 'yyyy-MM-dd'),
      end_date:
        contract?.end_date ||
        format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      signed_date: contract?.signed_date || undefined,
      status: contract?.status || 'draft',
      auto_renew: contract?.auto_renew || false,
      renewal_period_months: contract?.renewal_period_months || 12,
      expiry_notification_days: contract?.expiry_notification_days || 30,
      document_url: contract?.document_url || undefined,
    },
  })

  // Products are now loaded via React Query hook

  // Load contract items if editing
  useEffect(() => {
    if (contract?.contract_items) {
      setContractItems(
        contract.contract_items.map((item) => ({
          product_id: item.product_id || '',
          contract_price: item.contract_price || 0,
          min_quantity: item.min_quantity || 0,
          max_quantity: item.max_quantity || undefined,
          price_locked: item.price_locked || true,
          notes: item.notes || '',
        }))
      )
    }
  }, [contract])

  const addContractItem = () => {
    setContractItems([
      ...contractItems,
      {
        product_id: '',
        contract_price: 0,
        min_quantity: 0,
        price_locked: true,
      },
    ])
  }

  const removeContractItem = (index: number) => {
    setContractItems(contractItems.filter((_, i) => i !== index))
  }

  const updateContractItem = <K extends keyof ContractItemForm>(
    index: number,
    field: K,
    value: ContractItemForm[K]
  ) => {
    const updated = [...contractItems]
    updated[index] = { ...updated[index], [field]: value }
    setContractItems(updated)
  }

  const onSubmit = async (values: z.infer<typeof contractSchema>) => {
    setLoading(true)
    try {
      const formData = new FormData()

      // Add contract fields
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString())
        }
      })

      // Add contract items as JSON
      formData.append(
        'contract_items',
        JSON.stringify(contractItems.filter((item) => item.product_id))
      )

      if (contract) {
        formData.append('id', contract.id)
        await updateContract(formData)
        toast.success('Contract updated successfully')
      } else {
        await createContract(formData)
        toast.success('Contract created successfully')
      }

      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save contract'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contract ? 'Edit Contract' : 'Create New Contract'}
          </DialogTitle>
          <DialogDescription>
            Set up a pricing contract with specific terms and product prices
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Contract Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Contract Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contract_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Number</FormLabel>
                      <FormControl>
                        <Input placeholder="CON-2024-001" {...field} />
                      </FormControl>
                      <FormDescription>
                        Unique contract identifier
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contract_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Annual Pricing Agreement"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Contract terms and conditions..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              field.value ? new Date(field.value) : undefined
                            }
                            onSelect={(date) =>
                              field.onChange(
                                date ? format(date, 'yyyy-MM-dd') : ''
                              )
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              field.value ? new Date(field.value) : undefined
                            }
                            onSelect={(date) =>
                              field.onChange(
                                date ? format(date, 'yyyy-MM-dd') : ''
                              )
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signed_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Signed Date (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              field.value ? new Date(field.value) : undefined
                            }
                            onSelect={(date) =>
                              field.onChange(
                                date ? format(date, 'yyyy-MM-dd') : ''
                              )
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="auto_renew"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Auto-renewal</FormLabel>
                        <FormDescription>
                          Automatically renew this contract when it expires
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch('auto_renew') && (
                  <FormField
                    control={form.control}
                    name="renewal_period_months"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Renewal Period (months)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="60"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value
                              const numValue = parseInt(value, 10)
                              if (
                                !isNaN(numValue) &&
                                numValue >= 1 &&
                                numValue <= 60
                              ) {
                                field.onChange(numValue)
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="document_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Document URL (Optional)</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="https://drive.google.com/..."
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Link to the signed contract document
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Contract Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Contract Products</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addContractItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>

              {contractItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No products added to contract yet
                </div>
              ) : (
                <div className="space-y-4">
                  {contractItems.map((item, index) => {
                    const selectedProduct = products.find(
                      (p) => p.id === item.product_id
                    )

                    return (
                      <div
                        key={index}
                        className="p-4 border rounded-lg space-y-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium">
                                Product
                              </label>
                              <Select
                                value={item.product_id}
                                onValueChange={(value) =>
                                  updateContractItem(index, 'product_id', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((product) => (
                                    <SelectItem
                                      key={product.id}
                                      value={product.id}
                                    >
                                      {product.sku} - {product.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <label className="text-sm font-medium">
                                Contract Price
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  $
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="999999.99"
                                  className="pl-8"
                                  value={item.contract_price}
                                  onChange={(e) => {
                                    const value = e.target.value

                                    // Allow empty string for clearing the field
                                    if (value === '') {
                                      updateContractItem(
                                        index,
                                        'contract_price',
                                        0
                                      )
                                      return
                                    }

                                    // Regex pattern for valid decimal numbers with up to 2 decimal places
                                    // Matches: 0, 0.1, 0.01, 1, 100, 100.99, etc.
                                    // Does not match: .1, 1., 1.234, -1, etc.
                                    const validPricePattern =
                                      /^\d+(\.\d{0,2})?$/

                                    // Maximum price limit for business rules (e.g., $999,999.99)
                                    const MAX_PRICE = 999999.99

                                    if (validPricePattern.test(value)) {
                                      const numValue = parseFloat(value)

                                      // Check for valid number, not Infinity, and within business limits
                                      if (
                                        !isNaN(numValue) &&
                                        isFinite(numValue) &&
                                        numValue >= 0 &&
                                        numValue <= MAX_PRICE
                                      ) {
                                        updateContractItem(
                                          index,
                                          'contract_price',
                                          numValue
                                        )
                                      }
                                    }
                                  }}
                                />
                              </div>
                              {selectedProduct && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  Base price: $
                                  {selectedProduct.base_price.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeContractItem(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">
                              Min Quantity
                            </label>
                            <Input
                              type="number"
                              min="0"
                              value={item.min_quantity}
                              onChange={(e) => {
                                const value = e.target.value
                                if (value === '') {
                                  updateContractItem(index, 'min_quantity', 0)
                                  return
                                }
                                const numValue = parseInt(value, 10)
                                if (
                                  !isNaN(numValue) &&
                                  numValue >= 0 &&
                                  numValue <= 999999
                                ) {
                                  updateContractItem(
                                    index,
                                    'min_quantity',
                                    numValue
                                  )
                                }
                              }}
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium">
                              Max Quantity (Optional)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              value={item.max_quantity || ''}
                              onChange={(e) => {
                                const value = e.target.value
                                if (value === '') {
                                  updateContractItem(
                                    index,
                                    'max_quantity',
                                    undefined
                                  )
                                  return
                                }
                                const numValue = parseInt(value, 10)
                                if (
                                  !isNaN(numValue) &&
                                  numValue >= 0 &&
                                  numValue <= 999999
                                ) {
                                  updateContractItem(
                                    index,
                                    'max_quantity',
                                    numValue
                                  )
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-start space-x-3">
                          <Checkbox
                            checked={item.price_locked}
                            onCheckedChange={(checked) =>
                              updateContractItem(index, 'price_locked', checked)
                            }
                          />
                          <div className="space-y-1 leading-none">
                            <label className="text-sm font-medium cursor-pointer">
                              Lock Price
                            </label>
                            <p className="text-sm text-muted-foreground">
                              Price cannot be changed during contract period
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium">
                            Notes (Optional)
                          </label>
                          <Textarea
                            value={item.notes || ''}
                            onChange={(e) =>
                              updateContractItem(index, 'notes', e.target.value)
                            }
                            placeholder="Special terms for this product..."
                            className="resize-none"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? 'Saving...'
                  : contract
                    ? 'Update Contract'
                    : 'Create Contract'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// Loading component for Suspense fallback
function ContractDialogSkeleton() {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-48"></div>
        <div className="h-4 bg-gray-200 rounded w-64"></div>
      </div>
    </div>
  )
}

// Main exported component with Suspense boundary
export function ContractDialog(props: ContractDialogProps) {
  return (
    <Suspense fallback={<ContractDialogSkeleton />}>
      <ContractDialogInner {...props} />
    </Suspense>
  )
}
