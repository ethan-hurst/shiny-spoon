'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'

interface CustomerFiltersProps {
  tiers: Array<{
    id: string
    name: string
    color: string
  }>
  defaultValues?: {
    search?: string
    status?: string
    tier_id?: string
    customer_type?: string
  }
}

export function CustomerFilters({ tiers, defaultValues }: CustomerFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const newSearchParams = new URLSearchParams(searchParams.toString())
      
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === '') {
          newSearchParams.delete(key)
        } else {
          newSearchParams.set(key, value)
        }
      })
      
      // Reset to page 1 when filters change
      if (Object.keys(params).length > 0) {
        newSearchParams.delete('page')
      }
      
      return newSearchParams.toString()
    },
    [searchParams]
  )

  const handleSearch = (value: string) => {
    startTransition(() => {
      router.push(`/customers?${createQueryString({ search: value })}`)
    })
  }

  const handleFilter = (key: string, value: string | null) => {
    startTransition(() => {
      router.push(`/customers?${createQueryString({ [key]: value })}`)
    })
  }

  const clearFilters = () => {
    startTransition(() => {
      router.push('/customers')
    })
  }

  const hasActiveFilters = defaultValues?.search || defaultValues?.status || 
    defaultValues?.tier_id || defaultValues?.customer_type

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          className="pl-8"
          defaultValue={defaultValues?.search}
          onChange={(e) => handleSearch(e.target.value)}
          disabled={isPending}
        />
      </div>

      {/* Status Filter */}
      <Select
        value={defaultValues?.status || ''}
        onValueChange={(value) => handleFilter('status', value || null)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
        </SelectContent>
      </Select>

      {/* Tier Filter */}
      <Select
        value={defaultValues?.tier_id || ''}
        onValueChange={(value) => handleFilter('tier_id', value || null)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Tiers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Tiers</SelectItem>
          {tiers.map((tier) => (
            <SelectItem key={tier.id} value={tier.id}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: tier.color }}
                />
                {tier.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Customer Type Filter */}
      <Select
        value={defaultValues?.customer_type || ''}
        onValueChange={(value) => handleFilter('customer_type', value || null)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Types</SelectItem>
          <SelectItem value="standard">Standard</SelectItem>
          <SelectItem value="vip">VIP ⭐</SelectItem>
          <SelectItem value="partner">Partner 🤝</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          disabled={isPending}
        >
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}