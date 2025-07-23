'use client'

import { useState } from 'react'
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { updateTeamMember } from '@/app/actions/team'
import { Shield, User, Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const formSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
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

export function EditMemberRoleDialog({ member, open, onOpenChange }: EditMemberRoleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: member.role as any,
    },
  })

  const roles = [
    {
      value: 'admin',
      label: 'Admin',
      description: 'Full access to all features and settings',
      icon: Shield,
    },
    {
      value: 'member',
      label: 'Member',
      description: 'Can view and edit data, but not settings',
      icon: User,
    },
    {
      value: 'viewer',
      label: 'Viewer',
      description: 'Can only view data, no editing allowed',
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
      toast.error(error instanceof Error ? error.message : 'Failed to update role')
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
            Update the role for {member.auth?.users?.email || 'this team member'}
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