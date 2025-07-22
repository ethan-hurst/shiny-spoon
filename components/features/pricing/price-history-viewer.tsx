'use client'

import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar as CalendarIcon,
  Download,
  Filter,
  Loader2,
  Search,
  User,
} from 'lucide-react'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'
import { PriceHistoryEntry, getChangeTypeIcon } from '@/types/customer-pricing.types'
import { DateRange } from 'react-day-picker'

interface PriceHistoryViewerProps {
  customerId?: string
  productId?: string
  limit?: number
}

export function PriceHistoryViewer({ 
  customerId, 
  productId,
  limit = 50 
}: PriceHistoryViewerProps) {
  const supabase = createBrowserClient()
  
  // State
  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [showFilters, setShowFilters] = useState(false)

  // Fetch history
  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('customer_price_history')
        .select(`
          *,
          products (
            id,
            sku,
            name
          ),
          created_by_user:auth.users!customer_price_history_created_by_fkey (
            id,
            email,
            user_metadata
          ),
          approved_by_user:auth.users!customer_price_history_approved_by_fkey (
            id,
            email,
            user_metadata
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (customerId) {
        query = query.eq('customer_id', customerId)
      }

      if (productId) {
        query = query.eq('product_id', productId)
      }

      if (changeTypeFilter !== 'all') {
        query = query.eq('change_type', changeTypeFilter)
      }

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString())
      }

      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString())
      }

      const { data, error } = await query

      if (error) throw error
      setHistory(data || [])
    } catch (error) {
      console.error('Failed to fetch price history:', error)
      toast.error('Failed to load price history')
    } finally {
      setLoading(false)
    }
  }, [supabase, customerId, productId, changeTypeFilter, dateRange, limit])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Export history
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const csvContent = [
        ['Date', 'Product', 'SKU', 'Old Price', 'New Price', 'Change %', 'Type', 'Reason', 'Changed By', 'Status'],
        ...history.map(entry => [
          format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm'),
          entry.products?.name || '',
          entry.products?.sku || '',
          entry.old_price?.toString() || '',
          entry.new_price?.toString() || '',
          entry.old_price && entry.new_price 
            ? ((entry.new_price - entry.old_price) / entry.old_price * 100).toFixed(2) + '%'
            : '',
          entry.change_type || '',
          entry.change_reason || '',
          entry.created_by_user?.email || '',
          entry.approval_status || 'approved'
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `price-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success('History exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export history')
    } finally {
      setExporting(false)
    }
  }, [history])

  // Calculate price change percentage
  const getPriceChange = (oldPrice: number | null, newPrice: number | null) => {
    if (!oldPrice || !newPrice) return null
    return ((newPrice - oldPrice) / oldPrice) * 100
  }

  // Get change indicator
  const getChangeIndicator = (change: number | null) => {
    if (!change) return null
    
    if (change > 0) {
      return (
        <span className="flex items-center text-red-600">
          <ArrowUpRight className="h-4 w-4" />
          {formatPercent(Math.abs(change))}
        </span>
      )
    } else {
      return (
        <span className="flex items-center text-green-600">
          <ArrowDownRight className="h-4 w-4" />
          {formatPercent(Math.abs(change))}
        </span>
      )
    }
  }

  // Get status badge
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>
      case 'pending':
        return <Badge variant="warning">Pending</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="secondary">Applied</Badge>
    }
  }

  // Filtered history
  const filteredHistory = history.filter(entry => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        entry.products?.name?.toLowerCase().includes(search) ||
        entry.products?.sku?.toLowerCase().includes(search) ||
        entry.change_reason?.toLowerCase().includes(search) ||
        entry.created_by_user?.email?.toLowerCase().includes(search)
      )
    }
    return true
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Price Change History</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || history.length === 0}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by product, SKU, or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={changeTypeFilter} onValueChange={setChangeTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All change types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="bulk">Bulk Update</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="tier_change">Tier Change</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No price changes found
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Old Price</TableHead>
                  <TableHead>New Price</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{entry.products?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.products?.sku}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.old_price ? formatCurrency(entry.old_price) : '-'}
                    </TableCell>
                    <TableCell>
                      {entry.new_price ? formatCurrency(entry.new_price) : '-'}
                    </TableCell>
                    <TableCell>
                      {getChangeIndicator(getPriceChange(entry.old_price, entry.new_price))}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <span>{getChangeTypeIcon(entry.change_type as any)}</span>
                        <span className="capitalize">{entry.change_type}</span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="truncate" title={entry.change_reason || ''}>
                        {entry.change_reason || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="text-sm">
                          {entry.created_by_user?.user_metadata?.full_name || 
                           entry.created_by_user?.email?.split('@')[0] || 
                           'System'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(entry.approval_status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}