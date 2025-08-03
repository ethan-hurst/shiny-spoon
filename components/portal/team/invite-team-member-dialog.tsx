'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, Loader2, Shield, User } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { TEAM_ROLES } from '@/lib/constants/team'
import { inviteTeamMember } from '@/app/actions/team'

const formSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
  role: z.enum(
    [
      TEAM_ROLES.ADMIN.value,
      TEAM_ROLES.MEMBER.value,
      TEAM_ROLES.VIEWER.value,
    ] as [string, ...string[]],
    {
      required_error: 'Please select a role',
    }
  ),
  message: z
    .string()
    .max(500, 'Message must be less than 500 characters')
    .optional(),
})

interface InviteTeamMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteTeamMemberDialog({
  open,
  onOpenChange,
}: InviteTeamMemberDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      role: TEAM_ROLES.MEMBER.value,
      message: '',
    },
  })

  const roles = [
    {
      value: TEAM_ROLES.ADMIN.value,
      label: TEAM_ROLES.ADMIN.label,
      description: TEAM_ROLES.ADMIN.description,
      icon: Shield,
    },
    {
      value: TEAM_ROLES.MEMBER.value,
      label: TEAM_ROLES.MEMBER.label,
      description: TEAM_ROLES.MEMBER.description,
      icon: User,
    },
    {
      value: TEAM_ROLES.VIEWER.value,
      label: TEAM_ROLES.VIEWER.label,
      description: TEAM_ROLES.VIEWER.description,
      icon: Eye,
    },
  ] as const

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)

    const formData = new FormData()
    formData.append('email', values.email)
    formData.append('role', values.role)
    if (values.message) {
      formData.append('message', values.message)
    }

    try {
      await inviteTeamMember(formData)
      toast.success('Invitation sent successfully')
      form.reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send invitation'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your team. They'll receive an email with
            instructions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="colleague@company.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    They'll receive an invitation at this email address
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid gap-3"
                    >
                      {roles.map((role) => (
                        <div key={role.value} className="relative">
                          <RadioGroupItem
                            value={role.value}
                            id={role.value}
                            className="peer sr-only"
                          />
                          <label
                            htmlFor={role.value}
                            className="flex items-start gap-3 rounded-lg border-2 border-muted bg-card p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                          >
                            <role.icon className="h-5 w-5 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-medium">{role.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {role.description}
                              </p>
                            </div>
                          </label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Message (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Hey! I'm inviting you to join our team on TruthSource..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Add a personal note to the invitation email
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
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
