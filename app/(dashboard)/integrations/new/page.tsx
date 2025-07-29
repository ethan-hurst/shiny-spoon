import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { IntegrationForm } from '@/components/features/integrations/integration-form'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Add Integration | TruthSource',
  description: 'Connect a new external system to TruthSource',
}

export default async function NewIntegrationPage() {
  const supabase = await createClient()

  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/onboarding')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/integrations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Integration</h1>
          <p className="text-muted-foreground">
            Connect TruthSource with your external systems
          </p>
        </div>
      </div>

      <IntegrationForm organizationId={profile.organization_id} />
    </div>
  )
}