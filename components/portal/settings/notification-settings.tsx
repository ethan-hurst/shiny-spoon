'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { updateNotificationPreferences } from '@/app/actions/settings'
import { 
  Bell, 
  CreditCard, 
  BarChart3, 
  Users, 
  Key, 
  Package, 
  Shield,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

interface NotificationPreferences {
  user_id: string
  email_notifications: boolean
  billing_alerts: boolean
  usage_alerts: boolean
  team_updates: boolean
  api_updates: boolean
  product_updates: boolean
  security_alerts: boolean
}

interface NotificationSettingsProps {
  preferences: NotificationPreferences
}

export function NotificationSettings({ preferences }: NotificationSettingsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState({
    emailNotifications: preferences.email_notifications,
    billingAlerts: preferences.billing_alerts,
    usageAlerts: preferences.usage_alerts,
    teamUpdates: preferences.team_updates,
    apiUpdates: preferences.api_updates,
    productUpdates: preferences.product_updates,
    securityAlerts: preferences.security_alerts,
  })

  const handleSave = async () => {
    setIsLoading(true)
    
    const formData = new FormData()
    Object.entries(settings).forEach(([key, value]) => {
      formData.append(key, value.toString())
    })

    try {
      await updateNotificationPreferences(formData)
      toast.success('Notification preferences updated')
    } catch (error) {
      toast.error('Failed to update preferences')
    } finally {
      setIsLoading(false)
    }
  }

  const notificationGroups = [
    {
      title: 'Billing & Subscription',
      description: 'Notifications about your billing and subscription',
      settings: [
        {
          key: 'billingAlerts',
          label: 'Billing Alerts',
          description: 'Payment failures, subscription changes, invoices',
          icon: CreditCard,
        },
      ],
    },
    {
      title: 'Usage & Limits',
      description: 'Alerts when approaching or exceeding limits',
      settings: [
        {
          key: 'usageAlerts',
          label: 'Usage Alerts',
          description: 'API limits, storage limits, quota warnings',
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'Team Activity',
      description: 'Updates about your team',
      settings: [
        {
          key: 'teamUpdates',
          label: 'Team Updates',
          description: 'New members, role changes, invitations',
          icon: Users,
        },
      ],
    },
    {
      title: 'API & Integration',
      description: 'Technical updates and changes',
      settings: [
        {
          key: 'apiUpdates',
          label: 'API Updates',
          description: 'API changes, deprecations, new endpoints',
          icon: Key,
        },
      ],
    },
    {
      title: 'Product Updates',
      description: 'New features and improvements',
      settings: [
        {
          key: 'productUpdates',
          label: 'Product Updates',
          description: 'New features, improvements, announcements',
          icon: Package,
        },
      ],
    },
    {
      title: 'Security',
      description: 'Important security notifications',
      settings: [
        {
          key: 'securityAlerts',
          label: 'Security Alerts',
          description: 'Suspicious activity, login attempts, security updates',
          icon: Shield,
        },
      ],
    },
  ] as const

  const hasChanges = JSON.stringify(settings) !== JSON.stringify({
    emailNotifications: preferences.email_notifications,
    billingAlerts: preferences.billing_alerts,
    usageAlerts: preferences.usage_alerts,
    teamUpdates: preferences.team_updates,
    apiUpdates: preferences.api_updates,
    productUpdates: preferences.product_updates,
    securityAlerts: preferences.security_alerts,
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Choose which notifications you want to receive via email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="master-switch" className="text-base font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Master Email Switch
              </Label>
              <p className="text-sm text-muted-foreground">
                Turn off to disable all email notifications
              </p>
            </div>
            <Switch
              id="master-switch"
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => {
                setSettings(prev => ({ ...prev, emailNotifications: checked }))
                if (!checked) {
                  // Disable all other notifications when master is off
                  setSettings(prev => ({
                    ...prev,
                    emailNotifications: false,
                    billingAlerts: false,
                    usageAlerts: false,
                    teamUpdates: false,
                    apiUpdates: false,
                    productUpdates: false,
                    securityAlerts: false,
                  }))
                }
              }}
            />
          </div>

          {settings.emailNotifications && (
            <>
              <Separator />
              
              <div className="space-y-8">
                {notificationGroups.map((group) => (
                  <div key={group.title} className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium">{group.title}</h3>
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    </div>
                    
                    <div className="space-y-4">
                      {group.settings.map((setting) => {
                        const Icon = setting.icon
                        return (
                          <div key={setting.key} className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label 
                                htmlFor={setting.key} 
                                className="text-sm font-normal flex items-center gap-2"
                              >
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {setting.label}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {setting.description}
                              </p>
                            </div>
                            <Switch
                              id={setting.key}
                              checked={settings[setting.key as keyof typeof settings]}
                              onCheckedChange={(checked) => 
                                setSettings(prev => ({ ...prev, [setting.key]: checked }))
                              }
                              disabled={!settings.emailNotifications}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )
}