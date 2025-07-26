// PRP-015: Manual Sync Trigger Component
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from '@/components/ui/use-toast'
import { Loader2, Play } from 'lucide-react'
import { createManualSyncJob } from '@/app/actions/sync-engine'

const formSchema = z.object({
  integration_id: z.string().uuid('Please select an integration'),
  entity_types: z.array(z.string()).min(1, 'Select at least one entity type'),
  sync_mode: z.enum(['full', 'incremental']),
  priority: z.enum(['low', 'normal', 'high']),
})

type FormData = z.infer<typeof formSchema>

interface ManualSyncTriggerProps {
  integrations: {
    id: string
    name: string
    platform: string
  }[]
}

const ENTITY_TYPES = [
  { value: 'products', label: 'Products' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'customers', label: 'Customers' },
  { value: 'orders', label: 'Orders' },
]

/**
 * Renders a form interface for manually triggering a synchronization job with configurable integration, entity types, sync mode, and priority.
 *
 * Displays selectable integrations, entity types, sync modes, and priorities, validates input, and submits the configuration to start a sync job. Provides user feedback on success or failure and refreshes the page upon successful submission.
 *
 * @param integrations - List of available integrations to select for the sync job
 * @returns The rendered manual sync trigger form component
 */
export function ManualSyncTrigger({ integrations }: ManualSyncTriggerProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      integration_id: '',
      entity_types: [],
      sync_mode: 'incremental',
      priority: 'normal',
    },
  })

  const onSubmit = async (values: FormData) => {
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('integration_id', values.integration_id)
      values.entity_types.forEach(type => {
        formData.append('entity_types', type)
      })
      formData.append('sync_mode', values.sync_mode)
      formData.append('priority', values.priority)

      await createManualSyncJob(formData)

      toast({
        title: 'Sync started',
        description: 'Your sync job has been queued and will start processing shortly.',
      })

      // Reset form
      form.reset()
      
      // Refresh the page to show the new job
      router.refresh()
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to start sync',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="integration_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Integration</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an integration" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {integrations.map((integration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        <div className="flex items-center gap-2">
                          <span>{integration.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({integration.platform})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose which integration to sync
                </FormDescription>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Higher priority jobs will be processed first
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="entity_types"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel>Entity Types</FormLabel>
                <FormDescription>
                  Select which data types to synchronize
                </FormDescription>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {ENTITY_TYPES.map((type) => (
                  <FormField
                    key={type.value}
                    control={form.control}
                    name="entity_types"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={type.value}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(type.value)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, type.value])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== type.value
                                      )
                                    )
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            {type.label}
                          </FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sync_mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sync Mode</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <RadioGroupItem value="incremental" />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        Incremental Sync
                      </FormLabel>
                      <FormDescription>
                        Only sync changes since the last successful sync
                      </FormDescription>
                    </div>
                  </FormItem>
                  <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <RadioGroupItem value="full" />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        Full Sync
                      </FormLabel>
                      <FormDescription>
                        Sync all data from the beginning (may take longer)
                      </FormDescription>
                    </div>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting sync...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Sync
            </>
          )}
        </Button>
      </form>
    </Form>
  )
}