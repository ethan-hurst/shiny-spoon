import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ContractDialog } from '@/components/features/pricing/contract-dialog'
import { ContractList } from '@/components/features/pricing/contract-list'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

interface ContractPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata(
  props: ContractPageProps
): Promise<Metadata> {
  const params = await props.params
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('company_name, display_name')
    .eq('id', params.id)
    .single()

  const customerName =
    customer?.display_name || customer?.company_name || 'Customer'

  return {
    title: `${customerName} - Contracts | TruthSource`,
    description: `Manage pricing contracts for ${customerName}`,
  }
}

/**
 * Retrieves customer details and their associated contracts, including contract items and product information, for a given customer ID.
 *
 * @param customerId - The unique identifier of the customer whose contracts are to be fetched.
 * @returns An object containing the customer and their contracts, or `null` if the customer is not found.
 */
async function getContractsData(customerId: string) {
  const supabase = await createClient()

  // Get customer details
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  if (customerError || !customer) {
    console.error('Error fetching customer:', customerError)
    return null
  }

  // Get contracts
  const { data: contracts, error: contractsError } = await supabase
    .from('customer_contracts')
    .select(
      `
      *,
      contract_items (
        *,
        products (
          id,
          sku,
          name
        )
      )
    `
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (contractsError) {
    console.error('Error fetching contracts:', contractsError)
    return { customer, contracts: [] }
  }

  return { customer, contracts }
}

export default async function CustomerContractsPage(props: ContractPageProps) {
  const params = await props.params
  const data = await getContractsData(params.id)

  if (!data) {
    notFound()
  }

  const { customer, contracts } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {customer.display_name || customer.company_name} - Contracts
          </h1>
          <p className="text-muted-foreground">
            Manage pricing contracts and agreements
          </p>
        </div>
        <ContractDialog customerId={params.id}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </ContractDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Contracts</CardTitle>
          <CardDescription>
            View and manage all customer pricing contracts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContractList
            customerId={params.id}
            contracts={contracts}
            customer={customer}
          />
        </CardContent>
      </Card>
    </div>
  )
}
