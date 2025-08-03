'use client'

import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Clock,
  FileText,
  Filter,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  ChangeType,
  getChangeTypeIcon,
  PriceHistoryEntry,
} from '@/types/customer-pricing.types'

interface PriceHistoryTimelineProps {
  history: PriceHistoryEntry[]
}

export function PriceHistoryTimeline({ history }: PriceHistoryTimelineProps) {
  const [filterProduct, setFilterProduct] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Get unique products and change types for filters
  const uniqueProducts = Array.from(
    new Set(history.map((h) => h.product_id))
  ).map((id) => {
    const entry = history.find((h) => h.product_id === id)
    return {
      id,
      name: entry?.products?.name || 'Unknown',
      sku: entry?.products?.sku || '',
    }
  })

  // Filter history
  const filteredHistory = history.filter((entry) => {
    if (filterProduct !== 'all' && entry.product_id !== filterProduct) {
      return false
    }
    if (filterType !== 'all' && entry.change_type !== filterType) {
      return false
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        entry.products?.name.toLowerCase().includes(search) ||
        entry.products?.sku.toLowerCase().includes(search) ||
        entry.change_reason?.toLowerCase().includes(search) ||
        entry.created_by_user?.email.toLowerCase().includes(search)
      )
    }
    return true
  })

  // Group by date
  const groupedHistory = filteredHistory.reduce(
    (groups, entry) => {
      const date = format(new Date(entry.created_at), 'yyyy-MM-dd')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(entry)
      return groups
    },
    {} as Record<string, PriceHistoryEntry[]>
  )

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No price history yet</h3>
        <p className="text-sm text-muted-foreground">
          Price changes will appear here as they occur
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <Input
            id="search"
            placeholder="Search by product, reason, or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {uniqueProducts.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.sku} - {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="bulk">Bulk Update</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="tier_change">Tier Change</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-9 top-0 bottom-0 w-px bg-border" />

        {Object.entries(groupedHistory)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, entries]) => (
            <div key={date} className="relative">
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">
                  {format(new Date(date), 'MMMM d, yyyy')}
                </h3>
              </div>

              {/* Entries for this date */}
              <div className="ml-12 space-y-4 mb-8">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        {/* Product info */}
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {getChangeTypeIcon(entry.change_type)}
                          </span>
                          <div>
                            <p className="font-medium">
                              {entry.products?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {entry.products?.sku}
                            </p>
                          </div>
                        </div>

                        {/* Price change */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {entry.old_price !== null && (
                              <>
                                <span className="text-sm text-muted-foreground">
                                  {formatCurrency(entry.old_price)}
                                </span>
                                <ArrowDown className="h-3 w-3 text-muted-foreground" />
                              </>
                            )}
                            <span className="font-semibold">
                              {formatCurrency(entry.new_price || 0)}
                            </span>
                          </div>

                          {/* Discount change */}
                          {(entry.old_discount_percent !== null ||
                            entry.new_discount_percent !== null) && (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  (entry.new_discount_percent || 0) >
                                  (entry.old_discount_percent || 0)
                                    ? 'default'
                                    : 'secondary'
                                }
                                className="text-xs"
                              >
                                {entry.old_discount_percent !== null && (
                                  <>
                                    {formatPercent(entry.old_discount_percent)}
                                    {' → '}
                                  </>
                                )}
                                {formatPercent(entry.new_discount_percent || 0)}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Reason */}
                        {entry.change_reason && (
                          <p className="text-sm text-muted-foreground">
                            {entry.change_reason}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {entry.created_by_user?.email || 'System'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(entry.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {entry.change_type.replace('_', ' ')}
                          </Badge>
                        </div>

                        {/* Approval info */}
                        {entry.requires_approval && (
                          <div className="flex items-center gap-2 mt-2">
                            {entry.approval_status === 'approved' &&
                            entry.approved_by_user ? (
                              <Badge variant="outline" className="text-xs">
                                Approved by {entry.approved_by_user.email}
                              </Badge>
                            ) : entry.approval_status === 'pending' ? (
                              <Badge
                                variant="outline"
                                className="text-xs text-yellow-600 border-yellow-600"
                              >
                                Pending Approval
                              </Badge>
                            ) : entry.approval_status === 'rejected' ? (
                              <Badge
                                variant="outline"
                                className="text-xs text-red-600 border-red-600"
                              >
                                Rejected
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Price impact indicator */}
                      <div className="flex items-center">
                        {entry.old_price && entry.new_price && (
                          <>
                            {(() => {
                              // Calculate percentage change safely
                              const percentageChange =
                                entry.old_price > 0
                                  ? ((entry.new_price - entry.old_price) /
                                      entry.old_price) *
                                    100
                                  : 0

                              if (entry.new_price > entry.old_price) {
                                return (
                                  <div className="flex items-center gap-1 text-red-600">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-sm font-medium">
                                      +{formatPercent(percentageChange)}
                                    </span>
                                  </div>
                                )
                              } else {
                                return (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <TrendingDown className="h-4 w-4" />
                                    <span className="text-sm font-medium">
                                      {formatPercent(percentageChange)}
                                    </span>
                                  </div>
                                )
                              }
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
