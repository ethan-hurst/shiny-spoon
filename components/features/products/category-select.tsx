'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'

interface CategorySelectProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function CategorySelect({
  value,
  onChange,
  disabled,
}: CategorySelectProps) {
  const [categories, setCategories] = useState<string[]>([])
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setIsLoading(true)
    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .single()

      if (profileError) {
        console.error('Error fetching user profile:', profileError)
        return
      }

      if (!profile) return

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('category')
        .eq('organization_id', profile.organization_id)
        .not('category', 'is', null)

      if (productsError) {
        console.error('Error fetching product categories:', productsError)
        return
      }

      if (products) {
        const uniqueCategories = [
          ...new Set(products.map((p) => p.category).filter(Boolean)),
        ] as string[]
        setCategories(uniqueCategories.sort())
      }
    } catch (error) {
      console.error('Unexpected error fetching categories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddNew = () => {
    const trimmedCategory = newCategory.trim()

    // Validate input
    if (!trimmedCategory) {
      return // Don't add empty categories
    }

    // Check if category already exists (case-insensitive)
    if (
      categories.some(
        (cat) => cat.toLowerCase() === trimmedCategory.toLowerCase()
      )
    ) {
      return // Don't add duplicate categories
    }

    // Add the new category
    onChange(trimmedCategory)
    setCategories([...categories, trimmedCategory].sort())
    setNewCategory('')
    setIsAddingNew(false)
  }

  if (isAddingNew) {
    return (
      <div className="flex gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="New category name"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddNew()
            }
          }}
          disabled={disabled}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={handleAddNew}
          disabled={!newCategory.trim() || disabled}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            setIsAddingNew(false)
            setNewCategory('')
          }}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select a category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
          {categories.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No categories yet
            </div>
          )}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={() => setIsAddingNew(true)}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
