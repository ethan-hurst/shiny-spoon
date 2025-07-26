// PRP-015: Sync Schedule Dialog Component
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import { Loader2, Save, Trash2 } from 'lucide-react'
import { updateSyncSchedule, deleteSyncSchedule } from '@/app/actions/sync-engine'
import type { SyncSchedule } from '@/types/sync-engine.types'

const formSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['every_5_min', 'every_15_min', 'every_30_min', 'hourly', 'daily', 'weekly']),
  entity_types: z.array(z.string()).min(1, 'Select at least one entity type'),
  active_hours_enabled: z.boolean(),
  active_hours_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional(),
  active_hours_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional(),
}).refine((data) => {
  // Add conditional validation (fix-32)
  if (data.active_hours_enabled) {
    return data.active_hours_start && data.active_hours_end
  }
  return true
}, {
  message: 'Start and end times are required when active hours are enabled',
  path: ['active_hours_start'],
})

type FormData = z.infer<typeof formSchema>

interface SyncScheduleDialogProps {
  integrationId: string
  schedule?: SyncSchedule
  onClose: () => void
}

const ENTITY_TYPES = [
  { value: 'products', label: 'Products' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'customers', label: 'Customers' },
  { value: 'orders', label: 'Orders' },
]

/**
 * Displays a dialog for creating or editing a synchronization schedule for an integration.
 *
 * Allows users to enable or disable the schedule, select sync frequency, choose entity types to sync, and optionally set active hours. Supports both creating a new schedule and editing or deleting an existing one. Provides form validation, submission, and user feedback.
 *
 * @param integrationId - The unique identifier of the integration to configure.
 * @param schedule - The existing schedule data to edit, or undefined to create a new schedule.
 * @param onClose - Callback invoked when the dialog is closed.
 */
export function SyncScheduleDialog({ integrationId, schedule, onClose }: SyncScheduleDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: schedule?.enabled ?? true,
      frequency: schedule?.frequency || 'daily',
      entity_types: schedule?.entity_types || [],
      active_hours_enabled: !!schedule?.active_hours,
      // Remove fallback values (fix-33)
      active_hours_start: schedule?.active_hours?.start,
      active_hours_end: schedule?.active_hours?.end,
    },
  })

  const activeHoursEnabled = form.watch('active_hours_enabled')

  const onSubmit = async (values: FormData) => {
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('integration_id', integrationId)
      formData.append('enabled', values.enabled.toString())
      formData.append('frequency', values.frequency)
      values.entity_types.forEach(type => {
        formData.append('entity_types', type)
      })
      
      if (values.active_hours_enabled && values.active_hours_start && values.active_hours_end) {
        formData.append('active_hours_enabled', 'true')
        formData.append('active_hours_start', values.active_hours_start)
        formData.append('active_hours_end', values.active_hours_end)
      }

      await updateSyncSchedule(formData)

      toast({
        title: 'Schedule saved',
        description: 'Sync schedule has been updated successfully.',
      })

      router.refresh()
      onClose()
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save schedule',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const formData = new FormData()
      formData.append('integration_id', integrationId)

      await deleteSyncSchedule(formData)

      toast({
        title: 'Schedule deleted',
        description: 'The sync schedule has been deleted.',
      })

      router.refresh()
      onClose()
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete schedule',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configure Sync Schedule</DialogTitle>
          <DialogDescription>
            Set up automatic synchronization for this integration
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Schedule
                    </FormLabel>
                    <FormDescription>
                      Automatically sync data based on the configured frequency
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
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sync Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="every_5_min">Every 5 minutes</SelectItem>
                      <SelectItem value="every_15_min">Every 15 minutes</SelectItem>
                      <SelectItem value="every_30_min">Every 30 minutes</SelectItem>
                      <SelectItem value="hourly">Every hour</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How often to automatically sync data
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entity_types"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel>Entity Types</FormLabel>
                    <FormDescription>
                      Select which data types to include in the sync
                    </FormDescription>
                  </div>
                  <div className="space-y-3">
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
              name="active_hours_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Active Hours
                    </FormLabel>
                    <FormDescription>
                      Only run syncs during specific hours
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

            {activeHoursEnabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="active_hours_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Start of active hours (24-hour format)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active_hours_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        End of active hours (24-hour format)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter className="flex justify-between">
              <div>
                {schedule && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Schedule
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Schedule
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Sync Schedule</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this schedule? This action cannot be undone and the integration will stop syncing automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Schedule'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}