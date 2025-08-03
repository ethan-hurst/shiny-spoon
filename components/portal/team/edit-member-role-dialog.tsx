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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { TEAM_ROLES } from '@/lib/constants/team'
import { updateTeamMember } from '@/app/actions/team'

const formSchema = z.object({
  role: z.enum([
    TEAM_ROLES.ADMIN.value,
    TEAM_ROLES.MEMBER.value,
    TEAM_ROLES.VIEWER.value,
  ] as [string, ...string[]]),
})

interface EditMemberRoleDialogProps {
  member: {
    user_id: string
    role: string
    auth?: {
      users?: {
        email?: string
      }
    }
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditMemberRoleDialog({
  member,
  open,
  onOpenChange,
}: EditMemberRoleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: member.role as any,
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
    if (values.role === member.role) {
      onOpenChange(false)
      return
    }

    setIsLoading(true)

    const formData = new FormData()
    formData.append('userId', member.user_id)
    formData.append('role', values.role)

    try {
      await updateTeamMember(formData)
      toast.success('Role updated successfully')
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update role'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change Member Role</DialogTitle>
          <DialogDescription>
            Update the role for{' '}
            {member.auth?.users?.email || 'this team member'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Select New Role</FormLabel>
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
                            id={`role-${role.value}`}
                            className="peer sr-only"
                          />
                          <label
                            htmlFor={`role-${role.value}`}
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
                Update Role
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
