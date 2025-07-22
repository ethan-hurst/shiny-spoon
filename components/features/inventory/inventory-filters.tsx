'use client'

import { useCallback, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import type { InventoryFilters as IInventoryFilters } from '@/types/inventory.types'

interface Warehouse {
  id: string
  name: string
  code: string
}

interface InventoryFiltersProps {
  warehouses: Warehouse[]
  currentFilters: IInventoryFilters
}

export function InventoryFilters({
  warehouses,
  currentFilters,
}: InventoryFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateFilters = useCallback(
    (updates: Partial<IInventoryFilters>) => {
      const params = new URLSearchParams(searchParams.toString())

      // Update or remove parameters
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || value === false) {
          params.delete(key)
        } else {
          params.set(key, String(value))
        }
      })

      startTransition(() => {
        router.push(`/inventory?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  const clearFilters = useCallback(() => {
    startTransition(() => {
      router.push('/inventory')
    })
  }, [router])

  const hasActiveFilters =
    currentFilters.warehouse_id ||
    currentFilters.search ||
    currentFilters.low_stock_only

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-[200px]">
        <Label htmlFor="search" className="sr-only">
          Search
        </Label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search by SKU or product name..."
            value={currentFilters.search || ''}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="pl-8"
            disabled={isPending}
          />
        </div>
      </div>

      <div className="min-w-[200px]">
        <Label htmlFor="warehouse" className="sr-only">
          Warehouse
        </Label>
        <Select
          value={currentFilters.warehouse_id || 'all'}
          onValueChange={(value) =>
            updateFilters({ warehouse_id: value === 'all' ? undefined : value })
          }
          disabled={isPending}
        >
          <SelectTrigger id="warehouse">
            <SelectValue placeholder="All warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name} ({warehouse.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="low-stock"
          checked={currentFilters.low_stock_only || false}
          onCheckedChange={(checked) =>
            updateFilters({ low_stock_only: checked || undefined })
          }
          disabled={isPending}
        />
        <Label
          htmlFor="low-stock"
          className="text-sm font-medium cursor-pointer"
        >
          Low stock only
        </Label>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          disabled={isPending}
        >
          <X className="mr-2 h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  )
}
