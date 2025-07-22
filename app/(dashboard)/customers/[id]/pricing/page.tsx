import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  AlertCircle,
  Clock,
  DollarSign,
  Download,
  FileText,
  History,
  Plus,
  Upload,
} from 'lucide-react'
// Components
import { CustomerPriceList } from '@/components/features/pricing/customer-price-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createServerClient } from '@/lib/supabase/server'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { CustomerPricingStats } from '@/types/customer-pricing.types'

// import { BulkPriceUpdate } from '@/components/features/pricing/bulk-price-update'
// import { PriceExportButton } from '@/components/features/pricing/price-export-button'

interface CustomerPricingPageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({
  params,
}: CustomerPricingPageProps): Promise<Metadata> {
  const supabase = createServerClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('company_name, display_name')
    .eq('id', params.id)
    .single()

  const customerName =
    customer?.display_name || customer?.company_name || 'Customer'

  return {
    title: `${customerName} - Pricing | TruthSource`,
    description: `Manage pricing for ${customerName}`,
  }
}

async function getCustomerData(customerId: string) {
  const supabase = createServerClient()

  // Get customer details
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select(
      `
      *,
      customer_tiers (
        name,
        discount_percentage
      )
    `
    )
    .eq('id', customerId)
    .single()

  if (customerError || !customer) {
    return null
  }

  // Get pricing statistics
  const { data: stats } = await supabase.rpc('get_customer_pricing_stats', {
    p_customer_id: customerId,
  })

  // Get pending approvals count
  const { count: pendingApprovals } = await supabase
    .from('price_approvals')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('status', 'pending')

  // Get expiring contracts
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const { count: expiringContracts } = await supabase
    .from('customer_contracts')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .lte('end_date', thirtyDaysFromNow.toISOString().split('T')[0])

  return {
    customer,
    stats: (stats as CustomerPricingStats) || {
      total_products: 0,
      custom_prices: 0,
      contract_prices: 0,
      average_discount: 0,
      pending_approvals: pendingApprovals || 0,
      expiring_contracts: expiringContracts || 0,
    },
  }
}

export default async function CustomerPricingPage({
  params,
}: CustomerPricingPageProps) {
  const data = await getCustomerData(params.id)

  if (!data) {
    notFound()
  }

  const { customer, stats } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {customer.display_name || customer.company_name} - Pricing
          </h1>
          <p className="text-muted-foreground">
            Manage customer-specific pricing, contracts, and approval workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* <BulkPriceUpdate customerId={params.id} /> */}
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Update
          </Button>
          {/* <PriceExportButton customerId={params.id} /> */}
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Prices</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.custom_prices}</div>
            <p className="text-xs text-muted-foreground">
              of {stats.total_products} products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Discount
            </CardTitle>
            <Badge variant="secondary">
              {customer.customer_tiers?.name || 'Standard'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(stats.average_discount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Tier discount:{' '}
              {formatPercent(customer.customer_tiers?.discount_percentage || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Contract Prices
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contract_prices}</div>
            {stats.expiring_contracts > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {stats.expiring_contracts} expiring soon
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approvals
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_approvals}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prices">Price List</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="approvals" className="relative">
            Approvals
            {stats.pending_approvals > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
              >
                {stats.pending_approvals}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Pricing</CardTitle>
              <CardDescription>
                View and manage customer-specific pricing for all products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerPriceList customerId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Contracts</CardTitle>
              <CardDescription>
                Manage contract pricing agreements and terms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                Contract management will be implemented
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Price Change History</CardTitle>
              <CardDescription>
                View all historical price changes and approvals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                Price history timeline will be implemented
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>
                Review and approve price change requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                Approval queue will be implemented
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
