// PRP-016: Data Accuracy Monitor - Alert Configuration Dialog
'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { upsertAlertRule } from '@/app/actions/monitoring'
import { Loader2 } from 'lucide-react'

const alertRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  entityType: z.array(z.string()).optional(),
  severityThreshold: z.enum(['low', 'medium', 'high', 'critical']),
  accuracyThreshold: z.number().min(0).max(100),
  discrepancyCountThreshold: z.number().min(1),
  checkFrequency: z.number().min(300), // minimum 5 minutes
  evaluationWindow: z.number().min(300),
  notificationChannels: z.array(z.enum(['email', 'sms', 'in_app', 'webhook'])).min(1),
  autoRemediate: z.boolean(),
})

type AlertRuleForm = z.infer<typeof alertRuleSchema>

interface AlertConfigDialogProps {
  rule?: any
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function AlertConfigDialog({
  rule,
  open,
  onOpenChange,
  children,
}: AlertConfigDialogProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AlertRuleForm>({
    resolver: zodResolver(alertRuleSchema),
    defaultValues: rule ? {
      name: rule.name,
      description: rule.description || '',
      entityType: rule.entity_type || [],
      severityThreshold: rule.severity_threshold || 'medium',
      accuracyThreshold: rule.accuracy_threshold || 95,
      discrepancyCountThreshold: rule.discrepancy_count_threshold || 10,
      checkFrequency: rule.check_frequency || 3600,
      evaluationWindow: rule.evaluation_window || 3600,
      notificationChannels: rule.notification_channels || ['in_app'],
      autoRemediate: rule.auto_remediate || false,
    } : {
      name: '',
      description: '',
      entityType: [],
      severityThreshold: 'medium',
      accuracyThreshold: 95,
      discrepancyCountThreshold: 10,
      checkFrequency: 3600,
      evaluationWindow: 3600,
      notificationChannels: ['in_app'],
      autoRemediate: false,
    },
  })

  const handleSubmit = async (data: AlertRuleForm) => {
    setIsSubmitting(true)
    
    const result = await upsertAlertRule(rule?.id, data)

    if (result.success) {
      toast({
        title: rule ? 'Alert rule updated' : 'Alert rule created',
        description: 'Your alert rule has been saved successfully.',
      })
      
      form.reset()
      if (onOpenChange) {
        onOpenChange(false)
      } else {
        setIsOpen(false)
      }
    } else {
      toast({
        title: 'Failed to save alert rule',
        description: result.error,
        variant: 'destructive',
      })
    }

    setIsSubmitting(false)
  }

  const entityTypes = [
    { value: 'product', label: 'Products' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'pricing', label: 'Pricing' },
    { value: 'customer', label: 'Customers' },
  ]

  const notificationChannels = [
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'in_app', label: 'In-App' },
    { value: 'webhook', label: 'Webhook' },
  ]

  return (
    <Dialog open={open !== undefined ? open : isOpen} onOpenChange={onOpenChange || setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Alert Rule' : 'Create Alert Rule'}</DialogTitle>
          <DialogDescription>
            Configure when and how you want to be notified about data accuracy issues.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Critical accuracy drop" {...field} />
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
                    <Textarea
                      placeholder="Describe when this alert should trigger..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Alert Conditions</h4>

              <FormField
                control={form.control}
                name="accuracyThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accuracy Threshold (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Alert when accuracy drops below this percentage
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discrepancyCountThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discrepancy Count Threshold</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Alert when discrepancies exceed this count
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="severityThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity threshold" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Only count discrepancies at or above this severity
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="entityType"
                render={() => (
                  <FormItem>
                    <FormLabel>Entity Types to Monitor</FormLabel>
                    <FormDescription>
                      Leave empty to monitor all entity types
                    </FormDescription>
                    <div className="space-y-2">
                      {entityTypes.map((type) => (
                        <FormField
                          key={type.value}
                          control={form.control}
                          name="entityType"
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
                                        ? field.onChange([...(field.value || []), type.value])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== type.value
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {type.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Timing</h4>

              <FormField
                control={form.control}
                name="checkFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check Frequency (seconds)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="300">5 minutes</SelectItem>
                        <SelectItem value="900">15 minutes</SelectItem>
                        <SelectItem value="1800">30 minutes</SelectItem>
                        <SelectItem value="3600">1 hour</SelectItem>
                        <SelectItem value="21600">6 hours</SelectItem>
                        <SelectItem value="86400">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often to evaluate this alert rule
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Notifications</h4>

              <FormField
                control={form.control}
                name="notificationChannels"
                render={() => (
                  <FormItem>
                    <FormLabel>Notification Channels</FormLabel>
                    <div className="space-y-2">
                      {notificationChannels.map((channel) => (
                        <FormField
                          key={channel.value}
                          control={form.control}
                          name="notificationChannels"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={channel.value}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(channel.value as any)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, channel.value])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== channel.value
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {channel.label}
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
                name="autoRemediate"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Auto-Remediation
                      </FormLabel>
                      <FormDescription>
                        Automatically attempt to fix common issues when detected
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
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange ? onOpenChange(false) : setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {rule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}