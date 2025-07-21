'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createContactSchema } from '@/lib/customers/validations'
import { createContact, updateContact } from '@/app/actions/customers'
import { ContactRecord } from '@/types/customer.types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { z } from 'zod'

interface ContactDialogProps {
  customerId: string
  contact?: ContactRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormData = z.infer<typeof createContactSchema>

export function ContactDialog({ customerId, contact, open, onOpenChange }: ContactDialogProps) {
  const router = useRouter()
  const isEditing = !!contact

  const form = useForm<FormData>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      customer_id: customerId,
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      role: 'contact',
      is_primary: false,
      portal_access: false,
      preferred_contact_method: 'email',
      receives_order_updates: true,
      receives_marketing: false,
      notes: '',
    },
  })

  // Reset form when contact changes
  useEffect(() => {
    if (contact) {
      form.reset({
        customer_id: customerId,
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        phone: contact.phone || '',
        mobile: contact.mobile || '',
        role: contact.role,
        is_primary: contact.is_primary,
        portal_access: contact.portal_access,
        preferred_contact_method: contact.preferred_contact_method,
        receives_order_updates: contact.receives_order_updates,
        receives_marketing: contact.receives_marketing,
        notes: contact.notes || '',
      })
    } else {
      form.reset({
        customer_id: customerId,
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        mobile: '',
        role: 'contact',
        is_primary: false,
        portal_access: false,
        preferred_contact_method: 'email',
        receives_order_updates: true,
        receives_marketing: false,
        notes: '',
      })
    }
  }, [contact, customerId, form])

  const onSubmit = async (data: FormData) => {
    try {
      const formData = new FormData()
      
      // Add all fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value.toString())
        }
      })

      // Add contact ID for updates
      if (isEditing && contact) {
        formData.append('id', contact.id)
      }

      const result = isEditing 
        ? await updateContact(formData)
        : await createContact(formData)

      if (result.error) {
        if (typeof result.error === 'string') {
          toast.error(result.error)
        } else {
          toast.error('Please check the form for errors')
        }
        return
      }

      toast.success(
        isEditing 
          ? 'Contact updated successfully' 
          : 'Contact created successfully'
      )
      
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error('An unexpected error occurred')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Contact' : 'Add New Contact'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update the contact information below' 
                : 'Enter the contact details below'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name*</Label>
                <Input
                  id="first_name"
                  {...form.register('first_name')}
                  placeholder="John"
                />
                {form.formState.errors.first_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.first_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name*</Label>
                <Input
                  id="last_name"
                  {...form.register('last_name')}
                  placeholder="Doe"
                />
                {form.formState.errors.last_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.last_name.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email*</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                placeholder="john@example.com"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...form.register('phone')}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  type="tel"
                  {...form.register('mobile')}
                  placeholder="+1 (555) 987-6543"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(value) => form.setValue('role', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="shipping">Shipping</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred_contact_method">Preferred Contact</Label>
                <Select
                  value={form.watch('preferred_contact_method')}
                  onValueChange={(value) => form.setValue('preferred_contact_method', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_primary"
                  checked={form.watch('is_primary')}
                  onCheckedChange={(checked) => form.setValue('is_primary', checked as boolean)}
                />
                <Label htmlFor="is_primary" className="cursor-pointer">
                  Set as primary contact
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="portal_access"
                  checked={form.watch('portal_access')}
                  onCheckedChange={(checked) => form.setValue('portal_access', checked as boolean)}
                />
                <Label htmlFor="portal_access" className="cursor-pointer">
                  Grant customer portal access
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="receives_order_updates"
                  checked={form.watch('receives_order_updates')}
                  onCheckedChange={(checked) => form.setValue('receives_order_updates', checked as boolean)}
                />
                <Label htmlFor="receives_order_updates" className="cursor-pointer">
                  Send order updates
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="receives_marketing"
                  checked={form.watch('receives_marketing')}
                  onCheckedChange={(checked) => form.setValue('receives_marketing', checked as boolean)}
                />
                <Label htmlFor="receives_marketing" className="cursor-pointer">
                  Send marketing communications
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...form.register('notes')}
                placeholder="Additional notes about this contact..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting 
                ? 'Saving...' 
                : isEditing 
                  ? 'Update Contact' 
                  : 'Add Contact'
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}