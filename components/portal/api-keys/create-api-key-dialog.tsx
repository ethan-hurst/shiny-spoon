'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { createApiKey } from '@/app/actions/api-keys'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  permissions: z
    .array(z.enum(['read', 'write', 'delete']))
    .min(1, 'Select at least one permission'),
  expiresAt: z.date().optional(),
})

interface CreateApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (result: { id: string; key: string }) => void
}

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateApiKeyDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: ['read'],
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
    formData.append('name', values.name)
    if (values.description) {
      formData.append('description', values.description)
    }
    values.permissions.forEach((perm) => formData.append('permissions', perm))
    if (values.expiresAt) {
      formData.append('expiresAt', values.expiresAt.toISOString())
    }

    try {
      const result = await createApiKey(formData)
      toast.success('API key created successfully')
      onSuccess(result)
      form.reset()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create API key'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key for programmatic access to your data
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
                    <Input placeholder="Production API Key" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name to identify this key
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Used for syncing inventory data to our warehouse management system"
                      className="resize-none"
                      {...field}
                    />
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
              name="expiresAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Expiration date (optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>No expiration</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Key will automatically expire on this date
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
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Key
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
