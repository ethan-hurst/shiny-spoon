'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, CreditCard, FileText, MapPin, User } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { createCustomerSchema } from '@/lib/customers/validations'
import { createCustomer, updateCustomer } from '@/app/actions/customers'
import { CustomerRecord } from '@/types/customer.types'

interface CustomerFormProps {
  customer?: CustomerRecord
  tiers: Array<{
    id: string
    name: string
    level: number
    discount_percentage: number
    color: string
  }>
  mode: 'create' | 'edit'
}

type FormData = z.infer<typeof createCustomerSchema>

export function CustomerForm({ customer, tiers, mode }: CustomerFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [useBillingForShipping, setUseBillingForShipping] = useState(
    !customer?.shipping_address ||
      JSON.stringify(customer.billing_address) ===
        JSON.stringify(customer.shipping_address)
  )

  const form = useForm<FormData>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      company_name: customer?.company_name || '',
      display_name: customer?.display_name || '',
      tax_id: customer?.tax_id || '',
      website: customer?.website || '',
      tier_id: customer?.tier_id || '',
      status: customer?.status || 'active',
      customer_type: customer?.customer_type || 'standard',
      billing_address: customer?.billing_address || {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
      },
      shipping_address: customer?.shipping_address,
      credit_limit: customer?.credit_limit || 0,
      payment_terms: customer?.payment_terms || 30,
      currency: customer?.currency || 'USD',
      notes: customer?.notes || '',
      internal_notes: customer?.internal_notes || '',
      tags: customer?.tags || [],
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    try {
      const formData = new FormData()

      // Add all fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'billing_address' || key === 'shipping_address') {
          if (value) {
            Object.entries(value).forEach(([addressKey, addressValue]) => {
              formData.append(
                `${key === 'billing_address' ? 'billing' : 'shipping'}_${addressKey}`,
                addressValue as string
              )
            })
          }
        } else if (key === 'tags' && Array.isArray(value)) {
          formData.append(key, value.join(','))
        } else if (value !== null && value !== undefined) {
          formData.append(key, value.toString())
        }
      })

      // Add shipping flag
      formData.append(
        'use_billing_for_shipping',
        useBillingForShipping.toString()
      )

      // Add customer ID for updates
      if (mode === 'edit' && customer) {
        formData.append('id', customer.id)
      }

      const result =
        mode === 'create'
          ? await createCustomer(formData)
          : await updateCustomer(formData)

      if (result.error) {
        if (typeof result.error === 'string') {
          toast.error(result.error)
        } else {
          toast.error('Please check the form for errors')
        }
        return
      }

      toast.success(
        mode === 'create'
          ? 'Customer created successfully'
          : 'Customer updated successfully'
      )

      router.push(`/customers/${result.data?.id}`)
    } catch (error) {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">
            <Building2 className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="addresses">
            <MapPin className="mr-2 h-4 w-4" />
            Addresses
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="mr-2 h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="contact">
            <User className="mr-2 h-4 w-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="notes">
            <FileText className="mr-2 h-4 w-4" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Basic information about the customer company
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name*</Label>
                  <Input
                    id="company_name"
                    {...form.register('company_name')}
                    placeholder="Acme Corporation"
                  />
                  {form.formState.errors.company_name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.company_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    {...form.register('display_name')}
                    placeholder="Acme Corp"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_id">Tax ID</Label>
                  <Input
                    id="tax_id"
                    {...form.register('tax_id')}
                    placeholder="12-3456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    {...form.register('website')}
                    placeholder="https://example.com"
                    type="url"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Classification</CardTitle>
              <CardDescription>Customer status, tier, and type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.watch('status')}
                    onValueChange={(value) =>
                      form.setValue(
                        'status',
                        value as 'active' | 'inactive' | 'suspended'
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_type">Customer Type</Label>
                  <Select
                    value={form.watch('customer_type')}
                    onValueChange={(value) =>
                      form.setValue(
                        'customer_type',
                        value as 'standard' | 'vip' | 'partner'
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="vip">VIP ⭐</SelectItem>
                      <SelectItem value="partner">Partner 🤝</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tier_id">Customer Tier</Label>
                  <Select
                    value={form.watch('tier_id') || ''}
                    onValueChange={(value) =>
                      form.setValue('tier_id', value || undefined)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No tier</SelectItem>
                      {tiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tier.color }}
                            />
                            {tier.name} ({tier.discount_percentage}% discount)
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Address</CardTitle>
              <CardDescription>
                Primary billing address for invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="billing_line1">Address Line 1*</Label>
                  <Input
                    id="billing_line1"
                    {...form.register('billing_address.line1')}
                    placeholder="123 Main Street"
                  />
                  {form.formState.errors.billing_address?.line1 && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.billing_address.line1.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="billing_line2">Address Line 2</Label>
                  <Input
                    id="billing_line2"
                    {...form.register('billing_address.line2')}
                    placeholder="Suite 100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_city">City*</Label>
                  <Input
                    id="billing_city"
                    {...form.register('billing_address.city')}
                    placeholder="New York"
                  />
                  {form.formState.errors.billing_address?.city && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.billing_address.city.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_state">State/Province*</Label>
                  <Input
                    id="billing_state"
                    {...form.register('billing_address.state')}
                    placeholder="NY"
                  />
                  {form.formState.errors.billing_address?.state && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.billing_address.state.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_postal_code">Postal Code*</Label>
                  <Input
                    id="billing_postal_code"
                    {...form.register('billing_address.postal_code')}
                    placeholder="10001"
                  />
                  {form.formState.errors.billing_address?.postal_code && (
                    <p className="text-sm text-destructive">
                      {
                        form.formState.errors.billing_address.postal_code
                          .message
                      }
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_country">Country*</Label>
                  <Input
                    id="billing_country"
                    {...form.register('billing_address.country')}
                    placeholder="US"
                    maxLength={2}
                  />
                  {form.formState.errors.billing_address?.country && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.billing_address.country.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
              <CardDescription>Delivery address for orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use_billing"
                  checked={useBillingForShipping}
                  onCheckedChange={(checked) =>
                    setUseBillingForShipping(checked as boolean)
                  }
                />
                <Label htmlFor="use_billing" className="cursor-pointer">
                  Same as billing address
                </Label>
              </div>

              {!useBillingForShipping && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="shipping_line1">Address Line 1</Label>
                    <Input
                      id="shipping_line1"
                      {...form.register('shipping_address.line1')}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="shipping_line2">Address Line 2</Label>
                    <Input
                      id="shipping_line2"
                      {...form.register('shipping_address.line2')}
                      placeholder="Suite 100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shipping_city">City</Label>
                    <Input
                      id="shipping_city"
                      {...form.register('shipping_address.city')}
                      placeholder="New York"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shipping_state">State/Province</Label>
                    <Input
                      id="shipping_state"
                      {...form.register('shipping_address.state')}
                      placeholder="NY"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shipping_postal_code">Postal Code</Label>
                    <Input
                      id="shipping_postal_code"
                      {...form.register('shipping_address.postal_code')}
                      placeholder="10001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shipping_country">Country</Label>
                    <Input
                      id="shipping_country"
                      {...form.register('shipping_address.country')}
                      placeholder="US"
                      maxLength={2}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Settings</CardTitle>
              <CardDescription>
                Credit limits, payment terms, and currency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="credit_limit">Credit Limit</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    min="0"
                    max="1000000"
                    {...form.register('credit_limit', { valueAsNumber: true })}
                    placeholder="0"
                  />
                  {form.formState.errors.credit_limit && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.credit_limit.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment Terms (days)</Label>
                  <Input
                    id="payment_terms"
                    type="number"
                    min="0"
                    max="365"
                    {...form.register('payment_terms', { valueAsNumber: true })}
                    placeholder="30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={form.watch('currency')}
                    onValueChange={(value) => form.setValue('currency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">
                        AUD - Australian Dollar
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Primary Contact</CardTitle>
              <CardDescription>
                You can add the primary contact now or add contacts later
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contact management will be available after creating the customer
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notes & Tags</CardTitle>
              <CardDescription>
                Additional information and categorization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Customer Notes</Label>
                <Textarea
                  id="notes"
                  {...form.register('notes')}
                  placeholder="Public notes visible to the customer..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal_notes">Internal Notes</Label>
                <Textarea
                  id="internal_notes"
                  {...form.register('internal_notes')}
                  placeholder="Private notes only visible to your team..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  {...form.register('tags')}
                  placeholder="wholesale, premium, repeat-buyer (comma separated)"
                />
                <p className="text-sm text-muted-foreground">
                  Comma-separated tags for grouping and filtering
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving...'
            : mode === 'create'
              ? 'Create Customer'
              : 'Update Customer'}
        </Button>
      </div>
    </form>
  )
}
