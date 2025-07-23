'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { changePassword, downloadAccountData } from '@/app/actions/settings'
import { 
  Lock, 
  Shield, 
  Download, 
  AlertTriangle,
  Loader2,
  Smartphone,
  Key
} from 'lucide-react'
import { toast } from 'sonner'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

interface SecuritySettingsProps {
  user: any
}

export function SecuritySettings({ user }: SecuritySettingsProps) {
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDownloadConfirmation, setShowDownloadConfirmation] = useState(false)

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function onPasswordSubmit(values: z.infer<typeof passwordSchema>) {
    setIsChangingPassword(true)
    
    const formData = new FormData()
    formData.append('currentPassword', values.currentPassword)
    formData.append('newPassword', values.newPassword)
    formData.append('confirmPassword', values.confirmPassword)

    try {
      await changePassword(formData)
      toast.success('Password changed successfully')
      setShowPasswordDialog(false)
      passwordForm.reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDownloadData = async () => {
    setIsDownloading(true)
    
    try {
      const result = await downloadAccountData()
      
      // Create and download file
      const blob = new Blob([result.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Account data downloaded successfully')
    } catch (error) {
      toast.error('Failed to download account data')
    } finally {
      setIsDownloading(false)
      setShowDownloadConfirmation(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Change your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setShowPasswordDialog(true)}
            aria-label="Change password"
          >
            <Lock className="h-4 w-4 mr-2" aria-hidden="true" />
            Change Password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              Two-factor authentication adds an extra layer of security by requiring a code from your phone in addition to your password.
            </AlertDescription>
          </Alert>
          
          <Button 
            variant="outline" 
            disabled
            aria-label="Enable two-factor authentication (coming soon)"
          >
            <Shield className="h-4 w-4 mr-2" aria-hidden="true" />
            Enable Two-Factor Authentication
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Two-factor authentication is coming soon
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Manage your active sessions across devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">Current Session</p>
                <p className="text-xs text-muted-foreground">
                  Last active: Just now
                </p>
              </div>
              <Badge variant="secondary">Active</Badge>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full" 
              disabled
              aria-label="View all sessions (coming soon)"
            >
              View All Sessions
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
          <CardDescription>
            Download your data or manage privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Download Your Data</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get a copy of all your data stored in TruthSource
            </p>
            <Button 
              variant="outline" 
              onClick={() => setShowDownloadConfirmation(true)}
              disabled={isDownloading}
              aria-label="Download account data"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Preparing Download...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  Download Account Data
                </>
              )}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1">Danger Zone</p>
                <p className="text-sm">
                  Deleting your account is permanent and cannot be undone. 
                  Please contact support if you wish to delete your account.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one
            </DialogDescription>
          </DialogHeader>
          
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter current password"
                        aria-label="Current password"
                        autoComplete="current-password"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter new password"
                        aria-label="New password"
                        autoComplete="new-password"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Must be at least 8 characters with uppercase, lowercase, number, and special character
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Confirm new password"
                        aria-label="Confirm new password"
                        autoComplete="new-password"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPasswordDialog(false)}
                  disabled={isChangingPassword}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  Change Password
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDownloadConfirmation} onOpenChange={setShowDownloadConfirmation}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Download Account Data</DialogTitle>
            <DialogDescription>
              Are you sure you want to download all your account data? This will include all your personal information, settings, and activity.
            </DialogDescription>
          </DialogHeader>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your data will be downloaded as a JSON file containing all information associated with your account.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDownloadConfirmation(false)}
              disabled={isDownloading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDownloadData} 
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Download Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}