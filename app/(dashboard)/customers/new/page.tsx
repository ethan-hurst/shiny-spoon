import { notFound, redirect } from 'next/navigation'
import { CustomerForm } from '@/components/features/customers/customer-form'
import { createClient } from '@/lib/supabase/server'

export default async function NewCustomerPage() {
  const supabase = createClient()

  // Get user's organization for tier options
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    notFound()
  }

  // Get available tiers
  const { data: tiers } = await supabase
    .from('customer_tiers')
    .select('id, name, level, discount_percentage, color')
    .eq('organization_id', profile.organization_id)
    .order('level', { ascending: true })

  return (
    <div className="container mx-auto py-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Add New Customer</h1>
          <p className="text-muted-foreground">
            Create a new customer profile and optionally add their primary
            contact
          </p>
        </div>

        <CustomerForm tiers={tiers || []} mode="create" />
      </div>
    </div>
  )
}
