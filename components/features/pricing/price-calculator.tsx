'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calculator, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PriceCalculationResult } from '@/types/pricing.types'
import { toast } from 'sonner'

interface Product {
  id: string
  name: string
  sku: string
}

interface Customer {
  id: string
  name: string
  tier_id?: string
}

export function PriceCalculator() {
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [result, setResult] = useState<PriceCalculationResult | null>(null)
  const [explanation, setExplanation] = useState<string[]>([])

  const supabase = createClient()

  // Load products and customers on component mount
  useState(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [productsResult, customersResult] = await Promise.all([
          supabase
            .from('products')
            .select('id, name, sku')
            .eq('is_active', true)
            .order('name'),
          supabase
            .from('customers')
            .select('id, name, tier_id')
            .eq('is_active', true)
            .order('name'),
        ])

        if (productsResult.error) throw productsResult.error
        if (customersResult.error) throw customersResult.error

        setProducts(productsResult.data || [])
        setCustomers(customersResult.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load products and customers')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  })

  async function calculatePrice() {
    if (!selectedProduct) {
      toast.error('Please select a product')
      return
    }

    const qty = parseInt(quantity) || 1
    if (qty < 1) {
      toast.error('Quantity must be at least 1')
      return
    }

    setCalculating(true)
    try {
      const { data, error } = await supabase.rpc('calculate_product_price', {
        p_product_id: selectedProduct,
        p_customer_id: selectedCustomer || null,
        p_quantity: qty,
        p_requested_date: new Date().toISOString().split('T')[0],
      })

      if (error) throw error
      if (!data || data.length === 0) throw new Error('No pricing data returned')

      const calculationResult = data[0]
      setResult({
        base_price: parseFloat(calculationResult.base_price),
        final_price: parseFloat(calculationResult.final_price),
        discount_amount: parseFloat(calculationResult.discount_amount),
        discount_percent: parseFloat(calculationResult.discount_percent),
        margin_percent: parseFloat(calculationResult.margin_percent),
        applied_rules: calculationResult.applied_rules || [],
      })

      // Build explanation
      const explanationLines: string[] = [
        `Base price: ${formatCurrency(parseFloat(calculationResult.base_price))}`,
      ]

      if (calculationResult.applied_rules && calculationResult.applied_rules.length > 0) {
        explanationLines.push('Applied discounts:')
        calculationResult.applied_rules.forEach((rule: any) => {
          let ruleText = `• ${rule.name || rule.type}`
          if (rule.discount_amount) {
            ruleText += ` = -${formatCurrency(rule.discount_amount)}`
          }
          explanationLines.push(ruleText)
        })
      }

      if (parseFloat(calculationResult.discount_amount) > 0) {
        explanationLines.push(
          `Total discount: ${formatCurrency(parseFloat(calculationResult.discount_amount))} (${parseFloat(
            calculationResult.discount_percent
          ).toFixed(1)}%)`
        )
      }

      explanationLines.push(`Final price: ${formatCurrency(parseFloat(calculationResult.final_price))}`)
      explanationLines.push(`Margin: ${parseFloat(calculationResult.margin_percent).toFixed(1)}%`)

      setExplanation(explanationLines)
    } catch (error) {
      console.error('Error calculating price:', error)
      toast.error('Failed to calculate price')
    } finally {
      setCalculating(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="product">Product</Label>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger id="product">
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="customer">Customer (Optional)</Label>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger id="customer">
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No customer (list price)</SelectItem>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            placeholder="1"
          />
        </div>
      </div>

      <Button onClick={calculatePrice} disabled={calculating} className="w-full md:w-auto">
        {calculating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Calculating...
          </>
        ) : (
          <>
            <Calculator className="mr-2 h-4 w-4" />
            Calculate Price
          </>
        )}
      </Button>

      {result && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Base Price</p>
                <p className="text-2xl font-bold">{formatCurrency(result.base_price)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Final Price</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(result.final_price)}
                </p>
                {quantity !== '1' && (
                  <p className="text-sm text-muted-foreground">
                    Total: {formatCurrency(result.final_price * parseInt(quantity))}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(result.discount_amount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.discount_percent.toFixed(1)}% off
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">Price Calculation Details</h4>
              <div className="space-y-1 text-sm">
                {explanation.map((line, index) => (
                  <div key={index} className={line.startsWith('•') ? 'ml-4' : ''}>
                    {line}
                  </div>
                ))}
              </div>
            </div>

            {result.applied_rules.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Applied Rules</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.applied_rules.map((rule, index) => (
                      <Badge key={index} variant="secondary">
                        {rule.name || rule.type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="pt-2">
              <Badge
                variant={result.margin_percent >= 20 ? 'default' : 'destructive'}
                className="text-xs"
              >
                Margin: {result.margin_percent.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}