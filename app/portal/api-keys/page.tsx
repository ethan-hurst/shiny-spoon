import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/billing'
import { ApiKeysList } from '@/components/portal/api-keys/api-keys-list'
import { ApiKeyStats } from '@/components/portal/api-keys/api-key-stats'
import { ApiDocumentation } from '@/components/portal/api-keys/api-documentation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InfoIcon } from 'lucide-react'

export default async function ApiKeysPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  // Get API keys
  const { data: apiKeys } = await supabase
    .from('api_keys')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  // Get subscription for limits
  const subscription = await getSubscription(profile.organization_id)
  
  // Get API key limits based on plan
  const keyLimits: Record<string, number> = {
    starter: 3,
    growth: 10,
    scale: -1, // unlimited
  }
  
  const keyLimit = keyLimits[subscription?.plan || 'starter'] || 3
  const activeKeys = apiKeys?.filter((key: any) => key.is_active) || []

  // Get usage stats for the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: apiStats } = await supabase
    .from('api_call_logs')
    .select('api_key_id, status_code')
    .eq('organization_id', profile.organization_id)
    .gte('created_at', thirtyDaysAgo.toISOString())

  // Calculate stats
  const stats = {
    totalKeys: apiKeys?.length || 0,
    activeKeys: activeKeys.length,
    totalCalls: apiStats?.length || 0,
    successRate: apiStats && apiStats.length > 0 
      ? (apiStats.filter((s: any) => s.status_code >= 200 && s.status_code < 300).length / apiStats.length) * 100
      : 100,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">API Keys</h1>
        <p className="text-muted-foreground mt-2">
          Manage API keys for programmatic access to your data
        </p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          API keys provide programmatic access to your TruthSource data. Keep them secure and never share them publicly.
        </AlertDescription>
      </Alert>

      <ApiKeyStats stats={stats} />

      <ApiKeysList 
        apiKeys={apiKeys || []}
        keyLimit={keyLimit}
        activeKeyCount={activeKeys.length}
      />

      <ApiDocumentation />
    </div>
  )
}