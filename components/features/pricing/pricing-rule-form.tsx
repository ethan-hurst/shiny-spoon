'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createPricingRuleSchema, PricingRule, PricingRuleRecord, QuantityBreak } from '@/types/pricing.types'
import { QuantityBreaksEditor } from './quantity-breaks-editor'
import { z } from 'zod'

interface PricingRuleFormProps {
  initialData?: PricingRuleRecord & { quantity_breaks?: QuantityBreak[] }
}

export function PricingRuleForm({ initialData }: PricingRuleFormProps) {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [tiers, setTiers] = useState<any[]>([])
  const [quantityBreaks, setQuantityBreaks] = useState<QuantityBreak[]>(
    initialData?.quantity_breaks || []
  )

  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!initialData

  const form = useForm<z.infer<typeof createPricingRuleSchema>>({
    resolver: zodResolver(createPricingRuleSchema),
    defaultValues: initialData || {
      name: '',
      description: '',
      rule_type: 'tier',
      priority: 100,
      discount_type: 'percentage',
      discount_value: 0,
      is_exclusive: false,
      can_stack: true,
      is_active: true,
      conditions: {},
    },
  })

  useEffect(() => {
    loadReferenceData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadReferenceData() {
    try {
      const [productsResult, categoriesResult, customersResult, tiersResult] = await Promise.all([
        supabase.from('products').select('id, name, sku').eq('is_active', true).order('name'),
        supabase.from('product_categories').select('id, name').order('name'),
        supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
        supabase.from('customer_tiers').select('id, name').order('sort_order'),
      ])

      setProducts(productsResult.data || [])
      setCategories(categoriesResult.data || [])
      setCustomers(customersResult.data || [])
      setTiers(tiersResult.data || [])
    } catch (error) {
      console.error('Error loading reference data:', error)
      toast.error('Failed to load reference data')
    } finally {
      setLoadingData(false)
    }
  }

  async function onSubmit(values: z.infer<typeof createPricingRuleSchema>) {
    setLoading(true)
    try {
      // Prepare conditions based on rule type
      const conditions: any = {}
      
      if (values.rule_type === 'quantity' && quantityBreaks.length > 0) {
        // For quantity rules, we'll handle breaks separately
      }

      const ruleData = {
        ...values,
        conditions,
        // Clear discount values if rule type is quantity (uses quantity breaks instead)
        discount_type: values.rule_type === 'quantity' ? null : values.discount_type,
        discount_value: values.rule_type === 'quantity' ? null : values.discount_value,
      }

      if (isEdit) {
        // Update existing rule
        const { error } = await supabase
          .from('pricing_rules')
          .update(ruleData)
          .eq('id', initialData.id)

        if (error) throw error

        // Handle quantity breaks
        if (values.rule_type === 'quantity') {
          // Delete existing breaks
          await supabase
            .from('quantity_breaks')
            .delete()
            .eq('pricing_rule_id', initialData.id)

          // Insert new breaks
          if (quantityBreaks.length > 0) {
            const { error: breaksError } = await supabase
              .from('quantity_breaks')
              .insert(
                quantityBreaks.map((qb, index) => ({
                  ...qb,
                  pricing_rule_id: initialData.id,
                  sort_order: index,
                }))
              )

            if (breaksError) throw breaksError
          }
        }

        toast.success('Pricing rule updated successfully')
      } else {
        // Create new rule
        const { data, error } = await supabase
          .from('pricing_rules')
          .insert(ruleData)
          .select()
          .single()

        if (error) throw error

        // Handle quantity breaks for new rule
        if (values.rule_type === 'quantity' && quantityBreaks.length > 0) {
          const { error: breaksError } = await supabase
            .from('quantity_breaks')
            .insert(
              quantityBreaks.map((qb, index) => ({
                ...qb,
                pricing_rule_id: data.id,
                sort_order: index,
              }))
            )

          if (breaksError) throw breaksError
        }

        toast.success('Pricing rule created successfully')
      }

      router.push('/pricing')
      router.refresh()
    } catch (error) {
      console.error('Error saving pricing rule:', error)
      toast.error(isEdit ? 'Failed to update pricing rule' : 'Failed to create pricing rule')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return <div className="text-center py-8">Loading...</div>
  }

  const ruleType = form.watch('rule_type')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Configure the basic settings for this pricing rule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Summer Sale 2024" />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this pricing rule
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe when and how this rule applies..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="rule_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rule type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tier">Customer Tier Discount</SelectItem>
                        <SelectItem value="quantity">Quantity Break</SelectItem>
                        <SelectItem value="promotion">Promotional Discount</SelectItem>
                        <SelectItem value="override">Price Override</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>Lower numbers have higher priority</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="discount" className="space-y-4">
          <TabsList>
            <TabsTrigger value="discount">Discount Settings</TabsTrigger>
            <TabsTrigger value="applicability">Applicability</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="discount">
            <Card>
              <CardHeader>
                <CardTitle>Discount Configuration</CardTitle>
                <CardDescription>
                  {ruleType === 'quantity'
                    ? 'Configure quantity-based discounts'
                    : 'Set the discount type and value'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ruleType === 'quantity' ? (
                  <QuantityBreaksEditor
                    breaks={quantityBreaks}
                    onChange={setQuantityBreaks}
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="discount_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select discount type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage Off</SelectItem>
                              <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                              <SelectItem value="price">Fixed Price</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="discount_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {form.watch('discount_type') === 'percentage'
                              ? 'Percentage'
                              : 'Amount'}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applicability">
            <Card>
              <CardHeader>
                <CardTitle>Applicability Rules</CardTitle>
                <CardDescription>
                  Define which products and customers this rule applies to
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="product_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specific Product</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="All products" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">All products</SelectItem>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="All categories" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">All categories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specific Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="All customers" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">All customers</SelectItem>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customer_tier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Tier</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="All tiers" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">All tiers</SelectItem>
                          {tiers.map((tier) => (
                            <SelectItem key={tier.id} value={tier.id}>
                              {tier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Schedule Settings</CardTitle>
                <CardDescription>
                  Set when this pricing rule is active
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date?.toISOString().split('T')[0])}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Leave empty for immediate activation
                      </FormDescription>
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
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date?.toISOString().split('T')[0])}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Leave empty for no expiration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Configure stacking rules and exclusivity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="is_exclusive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Exclusive Rule</FormLabel>
                        <FormDescription>
                          When applied, no other rules will be processed after this one
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="can_stack"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Can Stack</FormLabel>
                        <FormDescription>
                          Allow this discount to combine with other discounts
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Enable or disable this pricing rule
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/pricing')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Update Rule' : 'Create Rule'}
          </Button>
        </div>
      </form>
    </Form>
  )
}