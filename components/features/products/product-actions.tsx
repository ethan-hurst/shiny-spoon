'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Edit, MoreHorizontal, Trash } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteProduct, duplicateProduct } from '@/app/actions/products'
import { Product } from '@/types/product.types'

interface ProductActionsProps {
  product: Product
}

export function ProductActions({ product }: ProductActionsProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleEdit = () => {
    router.push(`/dashboard/products/${product.id}/edit`)
  }

  const handleDuplicate = async () => {
    try {
      const result = await duplicateProduct(product.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Product duplicated successfully')
        router.refresh()
      }
    } catch (error) {
      toast.error('Failed to duplicate product')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteProduct(product.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Product deleted successfully')
        router.refresh()
      }
    } catch (error) {
      toast.error('Failed to delete product')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
