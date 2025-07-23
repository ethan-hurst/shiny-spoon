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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { inviteTeamMember } from '@/app/actions/team'
import { Shield, User, Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['admin', 'member', 'viewer']),
  message: z.string().max(500).optional(),
})

interface InviteTeamMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteTeamMemberDialog({ open, onOpenChange }: InviteTeamMemberDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      role: 'member',
      message: '',
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
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation')
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
            Send an invitation to join your team. They'll receive an email with instructions.
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