import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { WarehouseForm } from '@/components/features/warehouses/warehouse-form'

interface EditWarehousePageProps {
  params: {
    id: string
  }
}

export default async function EditWarehousePage({ params }: EditWarehousePageProps) {
  const supabase = createClient()
  
  // Get current user and organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Fetch warehouse
  const { data: warehouse, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (error || !warehouse) {
    notFound()
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Warehouse</h1>
        <p className="text-muted-foreground">
          Update warehouse information and settings
        </p>
      </div>
      
      <WarehouseForm warehouse={warehouse} />
    </div>
  )
}