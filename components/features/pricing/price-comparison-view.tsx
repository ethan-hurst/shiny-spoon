'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  DollarSign,
  Percent,
  Search,
  TrendingDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { CustomerPriceWithProduct } from '@/types/customer-pricing.types'

interface PriceComparisonViewProps {
  products: CustomerPriceWithProduct[]
}

// Helper functions for price calculations
function getBasePrice(product: CustomerPriceWithProduct): number {
  return product.product_pricing?.base_price || 0
}

function getCustomerPrice(product: CustomerPriceWithProduct): number {
  const basePrice = getBasePrice(product)

  if (product.override_price !== null) {
    return product.override_price
  }

  if (product.override_discount_percent !== null) {
    return basePrice * (1 - product.override_discount_percent / 100)
  }

  return basePrice
}

function getDiscountPercentage(product: CustomerPriceWithProduct): number {
  const basePrice = getBasePrice(product)
  const customerPrice = getCustomerPrice(product)

  if (basePrice === 0) return 0

  return ((basePrice - customerPrice) / basePrice) * 100
}

function getCost(product: CustomerPriceWithProduct): number {
  return product.product_pricing?.cost || 0
}

function getMarginPercentage(product: CustomerPriceWithProduct): number {
  const customerPrice = getCustomerPrice(product)
  const cost = getCost(product)

  if (customerPrice === 0) return 0

  return ((customerPrice - cost) / customerPrice) * 100
}

export function PriceComparisonView({ products }: PriceComparisonViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [discountFilter, setDiscountFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'discount' | 'value'>('discount')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Calculate statistics
  const stats = useMemo(() => {
    const productsWithCustomPrice = products.filter(
      (p) => p.override_price !== null || p.override_discount_percent !== null
    )

    const totalValue = products.reduce((sum, p) => {
      const basePrice = getBasePrice(p)
      const customerPrice = getCustomerPrice(p)
      return sum + (basePrice - customerPrice)
    }, 0)

    const avgDiscount =
      productsWithCustomPrice.length > 0
        ? productsWithCustomPrice.reduce((sum, p) => {
            return sum + getDiscountPercentage(p)
          }, 0) / productsWithCustomPrice.length
        : 0

    return {
      totalProducts: products.length,
      customPrices: productsWithCustomPrice.length,
      totalDiscountValue: totalValue,
      averageDiscount: avgDiscount,
    }
  }, [products])

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...products]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.products?.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.products?.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Discount filter
    if (discountFilter !== 'all') {
      switch (discountFilter) {
        case 'none':
          filtered = filtered.filter((p) => getDiscountPercentage(p) === 0)
          break
        case 'low':
          filtered = filtered.filter((p) => {
            const discount = getDiscountPercentage(p)
            return discount > 0 && discount <= 10
          })
          break
        case 'medium':
          filtered = filtered.filter((p) => {
            const discount = getDiscountPercentage(p)
            return discount > 10 && discount <= 20
          })
          break
        case 'high':
          filtered = filtered.filter((p) => getDiscountPercentage(p) > 20)
          break
      }
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0

      if (sortBy === 'discount') {
        comparison = getDiscountPercentage(a) - getDiscountPercentage(b)
      } else {
        // Sort by value (savings)
        const aValue = getBasePrice(a) - getCustomerPrice(a)
        const bValue = getBasePrice(b) - getCustomerPrice(b)
        comparison = aValue - bValue
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [products, searchTerm, discountFilter, sortBy, sortOrder])

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Total Products</p>
          </div>
          <p className="text-2xl font-bold">{stats.totalProducts}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Custom Prices</p>
          </div>
          <p className="text-2xl font-bold">{stats.customPrices}</p>
          <p className="text-xs text-muted-foreground">
            {formatPercent((stats.customPrices / stats.totalProducts) * 100)} of
            products
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Avg. Discount</p>
          </div>
          <p className="text-2xl font-bold">
            {formatPercent(stats.averageDiscount)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Total Discount Value</p>
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(stats.totalDiscountValue)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={discountFilter} onValueChange={setDiscountFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Discount range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All discounts</SelectItem>
            <SelectItem value="none">No discount</SelectItem>
            <SelectItem value="low">0-10% discount</SelectItem>
            <SelectItem value="medium">10-20% discount</SelectItem>
            <SelectItem value="high">20%+ discount</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={`${sortBy}-${sortOrder}`}
          onValueChange={(value) => {
            const [newSortBy, newSortOrder] = value.split('-') as [
              'discount' | 'value',
              'asc' | 'desc',
            ]
            setSortBy(newSortBy)
            setSortOrder(newSortOrder)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="discount-desc">Highest discount</SelectItem>
            <SelectItem value="discount-asc">Lowest discount</SelectItem>
            <SelectItem value="value-desc">Highest value</SelectItem>
            <SelectItem value="value-asc">Lowest value</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Comparison Table */}
      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="visual">Visual Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Base Price</TableHead>
                  <TableHead className="text-right">Customer Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Savings</TableHead>
                  <TableHead className="text-center">Margin Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const basePrice = getBasePrice(product)
                    const cost = getCost(product)
                    const customerPrice = getCustomerPrice(product)
                    const discount = getDiscountPercentage(product)
                    const savings = basePrice - customerPrice
                    const baseMargin =
                      basePrice > 0 ? ((basePrice - cost) / basePrice) * 100 : 0
                    const customerMargin = getMarginPercentage(product)
                    const marginDiff = customerMargin - baseMargin

                    return (
                      <TableRow key={product.product_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {product.products?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {product.products?.sku}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(basePrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(customerPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          {discount > 0 && (
                            <Badge
                              variant={
                                discount > 20 ? 'destructive' : 'secondary'
                              }
                            >
                              {formatPercent(discount)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {savings > 0 && (
                            <span className="text-green-600 font-medium">
                              {formatCurrency(savings)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {marginDiff !== 0 && (
                            <div className="flex items-center justify-center gap-1">
                              {marginDiff < 0 ? (
                                <ArrowDown className="h-3 w-3 text-red-600" />
                              ) : (
                                <ArrowUp className="h-3 w-3 text-green-600" />
                              )}
                              <span
                                className={`text-sm font-medium ${
                                  marginDiff < 0
                                    ? 'text-red-600'
                                    : 'text-green-600'
                                }`}
                              >
                                {formatPercent(Math.abs(marginDiff))}
                              </span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="visual" className="space-y-4">
          <div className="grid gap-4">
            {filteredProducts.slice(0, 20).map((product) => {
              const basePrice = getBasePrice(product)
              const customerPrice = getCustomerPrice(product)
              const discount = getDiscountPercentage(product)

              return (
                <div
                  key={product.product_id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{product.products?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.products?.sku}
                    </p>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Base</p>
                      <p className="font-medium">{formatCurrency(basePrice)}</p>
                    </div>
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Customer</p>
                      <p className="font-medium text-green-600">
                        {formatCurrency(customerPrice)}
                      </p>
                    </div>
                    <Badge
                      variant={discount > 20 ? 'destructive' : 'secondary'}
                      className="min-w-[60px] justify-center"
                    >
                      {formatPercent(discount)}
                    </Badge>
                  </div>
                </div>
              )
            })}
            {filteredProducts.length > 20 && (
              <p className="text-center text-sm text-muted-foreground">
                Showing top 20 products. Use table view to see all.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
