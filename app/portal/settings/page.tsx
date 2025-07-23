import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { NotificationSettings } from '@/components/portal/settings/notification-settings'
import { ProfileSettings } from '@/components/portal/settings/profile-settings'
import { SecuritySettings } from '@/components/portal/settings/security-settings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function SettingsPage() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  // Get notification preferences
  const { data: notificationPrefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // If no preferences exist, create default ones
  if (!notificationPrefs) {
    await supabase
      .from('notification_preferences')
      .insert({
        user_id: user.id,
        email_notifications: true,
        billing_alerts: true,
        usage_alerts: true,
        team_updates: true,
        api_updates: true,
        product_updates: true,
        security_alerts: true,
      })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileSettings 
            user={user}
            profile={profile}
            organization={profile.organizations}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings 
            preferences={notificationPrefs || {
              user_id: user.id,
              email_notifications: true,
              billing_alerts: true,
              usage_alerts: true,
              team_updates: true,
              api_updates: true,
              product_updates: true,
              security_alerts: true,
            }}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <SecuritySettings user={user} />
        </TabsContent>
      </Tabs>
    </div>
  )
}