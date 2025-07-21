'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Edit,
  FileText,
  Search,
  X,
  Filter,
  ArrowUpDown,
  MoreHorizontal
} from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { toast } from 'sonner'
import { CustomerPriceWithProduct, CustomerPriceFilters } from '@/types/customer-pricing.types'
import { createBrowserClient } from '@/lib/supabase/client'
import { useDebounce } from '@/hooks/use-debounce'

interface CustomerPriceListProps {
  customerId: string
  initialData?: CustomerPriceWithProduct[]
}

type SortField = 'sku' | 'name' | 'base_price' | 'customer_price' | 'discount'
type SortOrder = 'asc' | 'desc'

export function CustomerPriceList({ customerId, initialData = [] }: CustomerPriceListProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  // State
  const [products, setProducts] = useState<CustomerPriceWithProduct[]>(initialData)
  const [loading, setLoading] = useState(!initialData.length)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [priceSourceFilter, setPriceSourceFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('sku')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Fetch products with pricing
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      // Get all products with their pricing info for this customer
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          sku,
          name,
          category_id
        `)
        .order('sku')

      if (productsError) throw productsError

      // Get product pricing
      const { data: pricing, error: pricingError } = await supabase
        .from('product_pricing')
        .select('*')
        .in('product_id', products.map(p => p.id))

      if (pricingError) throw pricingError

      // Get customer pricing
      const { data: customerPricing, error: customerPricingError } = await supabase
        .from('customer_pricing')
        .select('*')
        .eq('customer_id', customerId)
        .in('product_id', products.map(p => p.id))

      if (customerPricingError) throw customerPricingError

      // Transform the data to match our type
      const transformed: CustomerPriceWithProduct[] = products.map(product => {
        const productPricing = pricing.find(p => p.product_id === product.id)
        const custPricing = customerPricing.find(cp => cp.product_id === product.id)
        
        return {
          id: custPricing?.id || `new-${product.id}`,
          customer_id: customerId,
          product_id: product.id,
          organization_id: '', // Will be filled by RLS
          override_price: custPricing?.override_price || null,
          override_discount_percent: custPricing?.override_discount_percent || null,
          contract_number: custPricing?.contract_number || null,
          contract_start: custPricing?.contract_start || null,
          contract_end: custPricing?.contract_end || null,
          requires_approval: custPricing?.requires_approval || false,
          approved_by: custPricing?.approved_by || null,
          approved_at: custPricing?.approved_at || null,
          notes: custPricing?.notes || null,
          created_at: custPricing?.created_at || '',
          updated_at: custPricing?.updated_at || '',
          created_by: custPricing?.created_by || null,
          approval_status: custPricing?.approval_status || 'approved',
          approval_requested_at: custPricing?.approval_requested_at || null,
          approval_requested_by: custPricing?.approval_requested_by || null,
          rejection_reason: custPricing?.rejection_reason || null,
          version: custPricing?.version || 1,
          previous_price: custPricing?.previous_price || null,
          bulk_update_id: custPricing?.bulk_update_id || null,
          import_notes: custPricing?.import_notes || null,
          products: {
            id: product.id,
            sku: product.sku,
            name: product.name,
            category_id: product.category_id
          },
          product_pricing: productPricing ? {
            base_price: productPricing.base_price,
            cost: productPricing.cost,
            currency: productPricing.currency
          } : undefined
        }
      })

      setProducts(transformed)
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [customerId, supabase])

  // Load initial data
  useEffect(() => {
    if (!initialData.length) {
      fetchProducts()
    }
  }, [fetchProducts, initialData.length])

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...products]

    // Search filter
    if (debouncedSearch) {
      filtered = filtered.filter(p => 
        p.products?.sku.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.products?.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.products?.category_id === categoryFilter)
    }

    // Price source filter
    if (priceSourceFilter !== 'all') {
      switch (priceSourceFilter) {
        case 'custom':
          filtered = filtered.filter(p => 
            (p.override_price !== null || p.override_discount_percent !== null) && 
            !p.contract_number
          )
          break
        case 'contract':
          filtered = filtered.filter(p => p.contract_number !== null)
          break
        case 'base':
          filtered = filtered.filter(p => 
            p.override_price === null && 
            p.override_discount_percent === null
          )
          break
      }
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortField) {
        case 'sku':
          aValue = a.products?.sku || ''
          bValue = b.products?.sku || ''
          break
        case 'name':
          aValue = a.products?.name || ''
          bValue = b.products?.name || ''
          break
        case 'base_price':
          aValue = a.product_pricing?.base_price || 0
          bValue = b.product_pricing?.base_price || 0
          break
        case 'customer_price':
          aValue = getCustomerPrice(a)
          bValue = getCustomerPrice(b)
          break
        case 'discount':
          aValue = getDiscountPercent(a)
          bValue = getDiscountPercent(b)
          break
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [products, debouncedSearch, categoryFilter, priceSourceFilter, sortField, sortOrder, getDiscountPercent])

  // Helper functions
  const getCustomerPrice = (product: CustomerPriceWithProduct): number => {
    if (product.override_price !== null) {
      return product.override_price
    }
    if (product.override_discount_percent !== null && product.product_pricing) {
      return product.product_pricing.base_price * (1 - product.override_discount_percent / 100)
    }
    return product.product_pricing?.base_price || 0
  }

  const getDiscountPercent = (product: CustomerPriceWithProduct): number => {
    const basePrice = product.product_pricing?.base_price || 0
    const customerPrice = getCustomerPrice(product)
    if (basePrice === 0) return 0
    return ((basePrice - customerPrice) / basePrice) * 100
  }

  const getPriceSource = (product: CustomerPriceWithProduct): string => {
    if (product.contract_number) return 'contract'
    if (product.override_price !== null || product.override_discount_percent !== null) return 'custom'
    return 'base'
  }

  // Handlers
  const handleEdit = useCallback((productId: string, currentPrice: number) => {
    setEditingId(productId)
    setEditValue(currentPrice.toFixed(2))
  }, [])

  const handleSave = useCallback(async (productId: string) => {
    setSaving(true)
    try {
      const newPrice = parseFloat(editValue)
      if (isNaN(newPrice) || newPrice < 0) {
        throw new Error('Invalid price')
      }

      // TODO: Call server action to update price
      toast.info('Price update functionality will be implemented with server actions')
      
      setEditingId(null)
      router.refresh()
    } catch (error) {
      toast.error('Failed to update price')
    } finally {
      setSaving(false)
    }
  }, [editValue, router])

  const handleCancel = useCallback(() => {
    setEditingId(null)
    setEditValue('')
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredProducts.map(p => p.product_id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(productId)
    } else {
      newSelected.delete(productId)
    }
    setSelectedIds(newSelected)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by SKU or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Select value={priceSourceFilter} onValueChange={setPriceSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Price source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All prices</SelectItem>
            <SelectItem value="custom">Custom prices</SelectItem>
            <SelectItem value="contract">Contract prices</SelectItem>
            <SelectItem value="base">Base prices only</SelectItem>
          </SelectContent>
        </Select>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedIds.size} selected
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => toast.info('Bulk operations will be implemented')}
            >
              Bulk Update
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    filteredProducts.length > 0 && 
                    filteredProducts.every(p => selectedIds.has(p.product_id))
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort('sku')}
              >
                <div className="flex items-center gap-1">
                  SKU
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Product Name
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer"
                onClick={() => handleSort('base_price')}
              >
                <div className="flex items-center justify-end gap-1">
                  Base Price
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer"
                onClick={() => handleSort('customer_price')}
              >
                <div className="flex items-center justify-end gap-1">
                  Customer Price
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer"
                onClick={() => handleSort('discount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Discount
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Source</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const customerPrice = getCustomerPrice(product)
                const discount = getDiscountPercent(product)
                const priceSource = getPriceSource(product)
                const isEditing = editingId === product.product_id

                return (
                  <TableRow key={product.product_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(product.product_id)}
                        onCheckedChange={(checked) => 
                          handleSelectOne(product.product_id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.products?.sku}</TableCell>
                    <TableCell>{product.products?.name}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(product.product_pricing?.base_price || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 w-24"
                            step="0.01"
                            min="0"
                            disabled={saving}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSave(product.product_id)}
                            disabled={saving}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancel}
                            disabled={saving}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className={discount > 0 ? 'font-semibold' : ''}>
                            {formatCurrency(customerPrice)}
                          </span>
                          {priceSource !== 'contract' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(product.product_id, customerPrice)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {discount > 0 && (
                        <Badge variant={discount > 20 ? 'destructive' : 'secondary'}>
                          {formatPercent(discount)} off
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {product.approval_status === 'pending' ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Pending
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Awaiting approval
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : product.approval_status === 'rejected' ? (
                        <Badge variant="destructive" className="gap-1">
                          <X className="h-3 w-3" />
                          Rejected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {priceSource === 'contract' ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="gap-1">
                                <FileText className="h-3 w-3" />
                                Contract
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Contract #{product.contract_number}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : priceSource === 'custom' ? (
                        <Badge variant="outline">Custom</Badge>
                      ) : (
                        <Badge variant="outline">Base</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toast.info('Actions menu will be implemented')}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}