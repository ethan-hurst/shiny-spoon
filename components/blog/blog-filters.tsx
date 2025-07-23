'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'

interface BlogFiltersProps {
  categories: string[]
  tags: string[]
  selectedCategory?: string
  selectedTag?: string
}

export function BlogFilters({
  categories,
  tags,
  selectedCategory,
  selectedTag,
}: BlogFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams)
    
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    
    // Reset to page 1 when filters change
    params.delete('page')
    
    const queryString = params.toString()
    router.push(queryString ? `/blog?${queryString}` : '/blog')
  }

  const clearFilters = () => {
    router.push('/blog')
  }

  const hasActiveFilters = selectedCategory || selectedTag

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Select
            value={selectedCategory || ''}
            onValueChange={(value) => updateFilter('category', value || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px] max-w-xs">
          <Select
            value={selectedTag || ''}
            onValueChange={(value) => updateFilter('tag', value || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear filters
          </Button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {selectedCategory && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 pl-2 pr-1 py-1"
            >
              Category: {selectedCategory}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => updateFilter('category', null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {selectedTag && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 pl-2 pr-1 py-1"
            >
              Tag: {selectedTag}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => updateFilter('tag', null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

// Import Badge since it's used in the active filters display
import { Badge } from '@/components/ui/badge'