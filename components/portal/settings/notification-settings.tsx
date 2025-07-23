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
import { NOTIFICATION_CATEGORIES, DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/constants/notifications'

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
    emailNotifications: preferences.email_notifications ?? DEFAULT_NOTIFICATION_PREFERENCES.emailNotifications,
    billingAlerts: preferences.billing_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.billingAlerts,
    usageAlerts: preferences.usage_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.usageAlerts,
    teamUpdates: preferences.team_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.teamUpdates,
    apiUpdates: preferences.api_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.apiUpdates,
    productUpdates: preferences.product_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.productUpdates,
    securityAlerts: preferences.security_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.securityAlerts,
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
      title: NOTIFICATION_CATEGORIES.BILLING.title,
      description: NOTIFICATION_CATEGORIES.BILLING.description,
      settings: [
        {
          key: NOTIFICATION_CATEGORIES.BILLING.settings.billingAlerts.key,
          label: NOTIFICATION_CATEGORIES.BILLING.settings.billingAlerts.label,
          description: NOTIFICATION_CATEGORIES.BILLING.settings.billingAlerts.description,
          icon: CreditCard,
        },
      ],
    },
    {
      title: NOTIFICATION_CATEGORIES.USAGE.title,
      description: NOTIFICATION_CATEGORIES.USAGE.description,
      settings: [
        {
          key: NOTIFICATION_CATEGORIES.USAGE.settings.usageAlerts.key,
          label: NOTIFICATION_CATEGORIES.USAGE.settings.usageAlerts.label,
          description: NOTIFICATION_CATEGORIES.USAGE.settings.usageAlerts.description,
          icon: BarChart3,
        },
      ],
    },
    {
      title: NOTIFICATION_CATEGORIES.TEAM.title,
      description: NOTIFICATION_CATEGORIES.TEAM.description,
      settings: [
        {
          key: NOTIFICATION_CATEGORIES.TEAM.settings.teamUpdates.key,
          label: NOTIFICATION_CATEGORIES.TEAM.settings.teamUpdates.label,
          description: NOTIFICATION_CATEGORIES.TEAM.settings.teamUpdates.description,
          icon: Users,
        },
      ],
    },
    {
      title: NOTIFICATION_CATEGORIES.API.title,
      description: NOTIFICATION_CATEGORIES.API.description,
      settings: [
        {
          key: NOTIFICATION_CATEGORIES.API.settings.apiUpdates.key,
          label: NOTIFICATION_CATEGORIES.API.settings.apiUpdates.label,
          description: NOTIFICATION_CATEGORIES.API.settings.apiUpdates.description,
          icon: Key,
        },
      ],
    },
    {
      title: NOTIFICATION_CATEGORIES.PRODUCT.title,
      description: NOTIFICATION_CATEGORIES.PRODUCT.description,
      settings: [
        {
          key: NOTIFICATION_CATEGORIES.PRODUCT.settings.productUpdates.key,
          label: NOTIFICATION_CATEGORIES.PRODUCT.settings.productUpdates.label,
          description: NOTIFICATION_CATEGORIES.PRODUCT.settings.productUpdates.description,
          icon: Package,
        },
      ],
    },
    {
      title: NOTIFICATION_CATEGORIES.SECURITY.title,
      description: NOTIFICATION_CATEGORIES.SECURITY.description,
      settings: [
        {
          key: NOTIFICATION_CATEGORIES.SECURITY.settings.securityAlerts.key,
          label: NOTIFICATION_CATEGORIES.SECURITY.settings.securityAlerts.label,
          description: NOTIFICATION_CATEGORIES.SECURITY.settings.securityAlerts.description,
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
                <Bell className="h-4 w-4" aria-hidden="true" />
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
                                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                {setting.label}
                              </Label>
                              <p className="text-xs text-muted-foreground" id={`${setting.key}-description`}>
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
                              aria-describedby={`${setting.key}-description`}
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
          <Button onClick={handleSave} disabled={isLoading} aria-label="Save notification preferences">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )
}