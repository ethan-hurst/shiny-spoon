'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { warehouseSchema } from '@/lib/validations/warehouse'
import { createWarehouse, updateWarehouse, createWarehouseTyped, updateWarehouseTyped } from '@/app/actions/warehouses'
import { AddressFields } from './address-fields'
import { ContactList } from './contact-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Warehouse } from '@/types/warehouse.types'

interface WarehouseFormProps {
  warehouse?: Warehouse
}

type FormValues = z.infer<typeof warehouseSchema>

export function WarehouseForm({ warehouse }: WarehouseFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: warehouse?.name || '',
      code: warehouse?.code || '',
      address: warehouse?.address || {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'USA',
      },
      contacts: warehouse?.contact || [{
        name: '',
        role: 'Manager',
        email: '',
        phone: '',
        isPrimary: true,
      }],
      is_default: warehouse?.is_default || false,
      active: warehouse?.active ?? true,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'contacts',
  })

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true)
    
    try {
      const result = warehouse 
        ? await updateWarehouseTyped(warehouse.id, {
            name: values.name,
            address: values.address,
            contacts: values.contacts,
            is_default: values.is_default,
            active: values.active,
          })
        : await createWarehouseTyped({
            name: values.name,
            code: values.code,
            address: values.address,
            contacts: values.contacts,
            is_default: values.is_default,
            active: values.active,
          })

      if (result?.error) {
        if (typeof result.error === 'string') {
          toast.error(result.error)
        } else {
          toast.error('Failed to save warehouse')
        }
      } else {
        toast.success(warehouse ? 'Warehouse updated' : 'Warehouse created')
        router.push('/dashboard/warehouses')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              General details about the warehouse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Main Distribution Center" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse Code</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="MAIN-DC"
                        className="uppercase"
                        disabled={!!warehouse} // Can't change code after creation
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription>
                      Unique identifier for this warehouse (cannot be changed)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Address Section */}
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>
              Physical location of the warehouse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddressFields form={form} />
          </CardContent>
        </Card>

        {/* Contacts Section */}
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>
              Add warehouse contacts and designate a primary contact
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactList 
              fields={fields}
              append={append}
              remove={remove}
              form={form}
            />
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Configure warehouse settings and status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Default Warehouse</FormLabel>
                    <FormDescription>
                      Use as default location for new inventory
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
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Inactive warehouses cannot receive inventory
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={warehouse?.is_default} // Can't deactivate default
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 
             warehouse ? 'Update Warehouse' : 'Create Warehouse'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/warehouses')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}