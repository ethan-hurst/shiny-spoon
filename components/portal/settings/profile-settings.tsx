'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Building2, Calendar, Loader2, Mail, User } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { Textarea } from '@/components/ui/textarea'
import { updateProfile } from '@/app/actions/settings'

const formSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100),
  bio: z.string().max(500).optional(),
})

interface ProfileSettingsProps {
  user: any
  profile: any
  organization: any
}

export function ProfileSettings({
  user,
  profile,
  organization,
}: ProfileSettingsProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: profile.display_name || user.email?.split('@')[0] || '',
      bio: profile.bio || '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)

    const formData = new FormData()
    formData.append('displayName', values.displayName)
    if (values.bio) {
      formData.append('bio', values.bio)
    }

    try {
      await updateProfile(formData)
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const getInitials = (email?: string) => {
    if (!email) return '??'
    return email.split('@')[0].slice(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
              <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Profile picture</p>
              <p className="text-xs text-muted-foreground">
                Your avatar is generated based on your email address
              </p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      This is how your name will appear across the platform
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        className="resize-none"
                        placeholder="Tell us a bit about yourself..."
                      />
                    </FormControl>
                    <FormDescription>
                      A brief description about you (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Your account information and organization details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email Address
              </p>
              <p className="text-sm">{user.email}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                User ID
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {user.id}
              </code>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Organization
              </p>
              <p className="text-sm">{organization.name}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Member Since
              </p>
              <p className="text-sm">
                {format(new Date(user.created_at), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
