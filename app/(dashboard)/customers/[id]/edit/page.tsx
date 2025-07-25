import { notFound } from 'next/navigation'
import { CustomerForm } from '@/components/features/customers/customer-form'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Server component for editing a customer within the authenticated user's organization.
 *
 * Retrieves the customer record and available customer tiers for the user's organization, ensuring access control. Renders a form pre-filled with the customer's data for editing. Triggers a 404 response if the customer does not exist or is inaccessible.
 *
 * @param props - Contains a promise resolving to route parameters with the customer ID.
 * @returns A React element rendering the customer edit form.
 */
export default async function EditCustomerPage(props: PageProps) {
  const params = await props.params
  const supabase = await createClient()

  // Get user's organization
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Fetch customer
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (error || !customer) {
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
          <h1 className="text-3xl font-bold">Edit Customer</h1>
          <p className="text-muted-foreground">
            Update customer information and settings
          </p>
        </div>

        <CustomerForm customer={customer} tiers={tiers || []} mode="edit" />
      </div>
    </div>
  )
}
