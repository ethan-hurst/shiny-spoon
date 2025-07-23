'use client'

import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { ProductFilters as Filters } from '@/types/product.types'

interface ProductFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  categories: string[]
}

export function ProductFilters({
  filters,
  onFiltersChange,
  categories,
}: ProductFiltersProps) {
  const [open, setOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<Filters>(filters)

  const handleApplyFilters = () => {
    onFiltersChange(localFilters)
    setOpen(false)
  }

  const handleClearFilters = () => {
    const clearedFilters: Filters = {}
    setLocalFilters(clearedFilters)
    onFiltersChange(clearedFilters)
    setOpen(false)
  }

  const activeFilterCount = Object.entries(filters).filter(
    ([_, value]) => value !== undefined && value !== ''
  ).length

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Products</SheetTitle>
          <SheetDescription>
            Apply filters to narrow down your product list
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Price Range */}
          <div className="space-y-3">
            <Label>Price Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  type="number"
                  placeholder="Min"
                  value={localFilters.priceRange?.min || ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      priceRange: {
                        ...localFilters.priceRange,
                        min: e.target.value ? parseFloat(e.target.value) : 0,
                        max: localFilters.priceRange?.max ?? 999999,
                      },
                    })
                  }
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Max"
                  value={localFilters.priceRange?.max || ''}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      priceRange: {
                        min: localFilters.priceRange?.min ?? 0,
                        max: e.target.value
                          ? parseFloat(e.target.value)
                          : 999999,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Category Filter */}
          <div className="space-y-3">
            <Label>Category</Label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  checked={!localFilters.category}
                  onChange={() =>
                    setLocalFilters({
                      ...localFilters,
                      category: undefined,
                    })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">All Categories</span>
              </label>
              {categories.map((category) => (
                <label
                  key={category}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="category"
                    checked={localFilters.category === category}
                    onChange={() =>
                      setLocalFilters({
                        ...localFilters,
                        category: category,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{category}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Status Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="active-only">Active Products Only</Label>
              <Switch
                id="active-only"
                checked={localFilters.active === true}
                onCheckedChange={(checked) =>
                  setLocalFilters({
                    ...localFilters,
                    active: checked ? true : undefined,
                  })
                }
              />
            </div>
          </div>

          <Separator />

          {/* Applied Filters Summary */}
          {activeFilterCount > 0 && (
            <div className="space-y-2">
              <Label>Applied Filters</Label>
              <div className="flex flex-wrap gap-2">
                {localFilters.priceRange && (
                  <Badge variant="secondary">
                    Price: ${localFilters.priceRange.min} - $
                    {localFilters.priceRange.max}
                    <button
                      onClick={() =>
                        setLocalFilters({
                          ...localFilters,
                          priceRange: undefined,
                        })
                      }
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {localFilters.category && (
                  <Badge variant="secondary">
                    Category: {localFilters.category}
                    <button
                      onClick={() =>
                        setLocalFilters({
                          ...localFilters,
                          category: undefined,
                        })
                      }
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {localFilters.active === true && (
                  <Badge variant="secondary">
                    Active Only
                    <button
                      onClick={() =>
                        setLocalFilters({
                          ...localFilters,
                          active: undefined,
                        })
                      }
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-8">
          <Button onClick={handleApplyFilters} className="flex-1">
            Apply Filters
          </Button>
          <Button
            variant="outline"
            onClick={handleClearFilters}
            disabled={activeFilterCount === 0}
          >
            Clear All
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
