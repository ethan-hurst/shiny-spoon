'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { updateApprovalRules } from '@/app/actions/pricing'

const approvalRulesSchema = z.object({
  discount_threshold_percent: z.number().min(0).max(100),
  margin_threshold_percent: z.number().min(0).max(100),
  price_increase_threshold_percent: z.number().min(0).max(500),
  auto_approve_under_amount: z.number().min(0),
  require_note_for_approval: z.boolean(),
})

type ApprovalRulesForm = z.infer<typeof approvalRulesSchema>

interface PricingSettingsFormProps {
  initialData: ApprovalRulesForm
}

export function PricingSettingsForm({ initialData }: PricingSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<ApprovalRulesForm>({
    resolver: zodResolver(approvalRulesSchema),
    defaultValues: initialData,
  })

  const onSubmit = async (values: ApprovalRulesForm) => {
    setLoading(true)
    try {
      const result = await updateApprovalRules(values)

      if (result.success) {
        toast.success('Pricing settings updated successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update settings')
      }
    } catch (error) {
      toast.error('An error occurred while updating settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Approval Rules</CardTitle>
            <CardDescription>
              Configure when price changes require approval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="discount_threshold_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount Threshold (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Price changes with discounts exceeding this percentage
                    require approval
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="margin_threshold_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Margin Threshold (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Price changes resulting in margins below this percentage
                    require approval
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price_increase_threshold_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price Increase Threshold (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Price increases exceeding this percentage require approval
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auto_approve_under_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auto-Approve Under Amount ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Price changes for items under this amount are automatically
                    approved
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="require_note_for_approval"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Require Note for Approval
                    </FormLabel>
                    <FormDescription>
                      Users must provide a reason when submitting prices for
                      approval
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

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
