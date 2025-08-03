'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { updateApiKey } from '@/app/actions/api-keys'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  permissions: z
    .array(z.enum(['read', 'write', 'delete']))
    .min(1, 'Select at least one permission'),
  isActive: z.boolean(),
})

interface EditApiKeyDialogProps {
  apiKey: {
    id: string
    name: string
    description?: string
    permissions: string[]
    is_active: boolean
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditApiKeyDialog({
  apiKey,
  open,
  onOpenChange,
}: EditApiKeyDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: apiKey.name,
      description: apiKey.description || '',
      permissions: apiKey.permissions as any,
      isActive: apiKey.is_active,
    },
  })

  const permissions = [
    {
      id: 'read',
      label: 'Read',
      description: 'View and retrieve data',
    },
    {
      id: 'write',
      label: 'Write',
      description: 'Create and update data',
    },
    {
      id: 'delete',
      label: 'Delete',
      description: 'Remove data',
    },
  ] as const

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)

    const formData = new FormData()
    formData.append('id', apiKey.id)
    formData.append('name', values.name)
    formData.append('description', values.description || '')
    values.permissions.forEach((perm) => formData.append('permissions', perm))
    formData.append('isActive', values.isActive.toString())

    try {
      await updateApiKey(formData)
      toast.success('API key updated successfully')
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to update API key')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit API Key</DialogTitle>
          <DialogDescription>
            Update the settings for this API key
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                    <Textarea className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permissions"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Permissions</FormLabel>
                    <FormDescription>
                      Select the permissions this API key should have
                    </FormDescription>
                  </div>
                  {permissions.map((permission) => (
                    <FormField
                      key={permission.id}
                      control={form.control}
                      name="permissions"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={permission.id}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(permission.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([
                                        ...field.value,
                                        permission.id,
                                      ])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== permission.id
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal">
                                {permission.label}
                              </FormLabel>
                              <FormDescription>
                                {permission.description}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Temporarily disable this key without revoking it
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
