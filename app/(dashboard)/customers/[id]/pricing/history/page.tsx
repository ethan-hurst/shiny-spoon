import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PriceHistoryTimeline } from '@/components/features/pricing/price-history-timeline'
import { PriceExportButton } from '@/components/features/pricing/price-export-button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { getPriceHistory } from '@/app/actions/customer-pricing'

interface PriceHistoryPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata(
  props: PriceHistoryPageProps
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
    title: `${customerName} - Price History | TruthSource`,
    description: `View price change history for ${customerName}`,
  }
}

async function getHistoryData(customerId: string) {
  const supabase = await createClient()

  // Get customer details
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  if (customerError || !customer) {
    return null
  }

  // Get price history
  try {
    const history = await getPriceHistory(customerId, undefined, 100)
    return { customer, history }
  } catch (error) {
    console.error('Error fetching price history:', error)
    return { customer, history: [] }
  }
}

export default async function PriceHistoryPage(props: PriceHistoryPageProps) {
  const params = await props.params
  const data = await getHistoryData(params.id)

  if (!data) {
    notFound()
  }

  const { customer, history } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {customer.display_name || customer.company_name} - Price History
          </h1>
          <p className="text-muted-foreground">
            Track all price changes and approvals over time
          </p>
        </div>
        <PriceExportButton 
          customerId={params.id} 
          customerName={customer.display_name || customer.company_name}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Price Change Timeline</CardTitle>
          <CardDescription>
            All historical price changes for this customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PriceHistoryTimeline history={history} />
        </CardContent>
      </Card>
    </div>
  )
}