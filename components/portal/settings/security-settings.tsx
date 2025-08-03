'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Shield, ShieldCheck, ShieldX, Smartphone } from 'lucide-react'
import { QRCode } from 'react-qr-code'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  disableTwoFactor,
  enableTwoFactor,
  verifyTwoFactor,
} from '@/app/actions/settings'

interface SecuritySettingsProps {
  user: any
}

export function SecuritySettings({ user }: SecuritySettingsProps) {
  const [verificationCode, setVerificationCode] = useState('')
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)

  const enable2FAMutation = useMutation({
    mutationFn: enableTwoFactor,
    onSuccess: (data) => {
      if (data.success) {
        setQrCodeData(data.qrCode)
        setSecret(data.secret)
        setIsEnrolling(true)
        toast.success('2FA setup initiated. Please scan the QR code.')
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to enable 2FA'
      )
    },
  })

  const verify2FAMutation = useMutation({
    mutationFn: verifyTwoFactor,
    onSuccess: () => {
      toast.success('Two-factor authentication enabled successfully!')
      setIsEnrolling(false)
      setQrCodeData(null)
      setSecret(null)
      setVerificationCode('')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Invalid verification code'
      )
    },
  })

  const disable2FAMutation = useMutation({
    mutationFn: disableTwoFactor,
    onSuccess: () => {
      toast.success('Two-factor authentication disabled')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to disable 2FA'
      )
    },
  })

  const handleEnable2FA = () => {
    enable2FAMutation.mutate()
  }

  const handleVerify2FA = () => {
    if (!verificationCode) {
      toast.error('Please enter the verification code')
      return
    }
    verify2FAMutation.mutate(verificationCode)
  }

  const handleDisable2FA = () => {
    disable2FAMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Security Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your account security and authentication preferences.
        </p>
      </div>

      <Separator />

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account with two-factor
            authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEnrolling ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Not Enabled</Badge>
                <span className="text-sm text-muted-foreground">
                  Your account is currently protected by password only.
                </span>
              </div>
              <Button
                onClick={handleEnable2FA}
                disabled={enable2FAMutation.isPending}
                className="flex items-center gap-2"
              >
                <Smartphone className="h-4 w-4" />
                Enable 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  Scan the QR code below with your authenticator app (Google
                  Authenticator, Authy, etc.)
                </AlertDescription>
              </Alert>

              <div className="flex justify-center">
                {qrCodeData && (
                  <div className="p-4 bg-white rounded-lg">
                    <QRCode value={qrCodeData} size={200} />
                  </div>
                )}
              </div>

              {secret && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Or enter this code manually in your authenticator app:
                  </p>
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {secret}
                  </code>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="verification-code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                  />
                  <Button
                    onClick={handleVerify2FA}
                    disabled={verify2FAMutation.isPending || !verificationCode}
                  >
                    Verify
                  </Button>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setIsEnrolling(false)
                  setQrCodeData(null)
                  setSecret(null)
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            View and manage your active sessions across devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Current Session</Badge>
              <span className="text-sm text-muted-foreground">
                This device - {new Date().toLocaleDateString()}
              </span>
            </div>
            <Button variant="outline" size="sm">
              View All Sessions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Change your account password to keep it secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline">Change Password</Button>
        </CardContent>
      </Card>
    </div>
  )
}
