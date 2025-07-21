import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Calculator, FileDown, FileUp, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import { PricingRulesList } from '@/components/features/pricing/pricing-rules-list'
import { PriceCalculator } from '@/components/features/pricing/price-calculator'
import { MarginAlerts } from '@/components/features/pricing/margin-alerts'
import { PricingStats } from '@/components/features/pricing/pricing-stats'
import { PromotionCalendar } from '@/components/features/pricing/promotion-calendar'
import { PricingImportExport } from '@/components/features/pricing/pricing-import-export'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Pricing Management',
  description: 'Manage pricing rules, discounts, and promotions',
}

export default async function PricingPage() {
  const supabase = createClient()

  // Fetch pricing stats
  const [rulesResult, calculationsResult, alertsResult] = await Promise.all([
    // Active pricing rules count by type
    supabase
      .from('pricing_rules')
      .select('rule_type, id')
      .eq('is_active', true)
      .gte('end_date', new Date().toISOString().split('T')[0])
      .lte('start_date', new Date().toISOString().split('T')[0]),

    // Recent price calculations stats
    supabase
      .from('price_calculations')
      .select('discount_percent, margin_percent')
      .gte('requested_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('requested_at', { ascending: false })
      .limit(100),

    // Low margin alerts
    supabase
      .from('price_calculations')
      .select('*, products!inner(name, sku)')
      .lt('margin_percent', 15)
      .gte('requested_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('margin_percent', { ascending: true })
      .limit(5),
  ])

  // Process stats
  const rulesByType = rulesResult.data?.reduce((acc, rule) => {
    acc[rule.rule_type] = (acc[rule.rule_type] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  const avgDiscount = calculationsResult.data?.length
    ? calculationsResult.data.reduce((sum, calc) => sum + (calc.discount_percent || 0), 0) / calculationsResult.data.length
    : 0

  const avgMargin = calculationsResult.data?.length
    ? calculationsResult.data.reduce((sum, calc) => sum + (calc.margin_percent || 0), 0) / calculationsResult.data.length
    : 0

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pricing Management</h1>
          <p className="text-muted-foreground mt-1">
            Configure pricing rules, manage discounts, and monitor margins
          </p>
        </div>
        <div className="flex gap-2">
          <PricingImportExport />
          <Button asChild>
            <Link href="/pricing/rules/new">
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Badge variant="secondary">{Object.values(rulesByType).reduce((a, b) => a + b, 0)}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {Object.entries(rulesByType).map(([type, count]) => (
                <div key={type} className="flex justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{type}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Discount</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDiscount.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days across all rules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              After all discounts applied
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Margin Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertsResult.data?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Products below 15% margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Low Margin Alerts */}
      {alertsResult.data && alertsResult.data.length > 0 && (
        <MarginAlerts alerts={alertsResult.data} />
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Pricing Rules</TabsTrigger>
          <TabsTrigger value="calculator">Price Calculator</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <PricingRulesList />
        </TabsContent>

        <TabsContent value="calculator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Price Calculator</CardTitle>
              <CardDescription>
                Test pricing rules and see how they affect final prices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PriceCalculator />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promotions" className="space-y-4">
          <PromotionCalendar />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <PricingStats />
        </TabsContent>
      </Tabs>
    </div>
  )
}