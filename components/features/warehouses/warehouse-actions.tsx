'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Edit, Star, Power, Trash2, Package } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { WarehouseWithDetails } from '@/types/warehouse.types'
import { deleteWarehouse, setDefaultWarehouse, toggleWarehouseStatus } from '@/app/actions/warehouses'

interface WarehouseActionsProps {
  warehouse: WarehouseWithDetails
}

export function WarehouseActions({ warehouse }: WarehouseActionsProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSetDefault = async () => {
    setIsLoading(true)
    try {
      const result = await setDefaultWarehouse(warehouse.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Default warehouse updated')
      }
    } catch (error) {
      toast.error('Failed to update default warehouse')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    setIsLoading(true)
    try {
      const result = await toggleWarehouseStatus(warehouse.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Warehouse ${warehouse.active ? 'deactivated' : 'activated'}`)
      }
    } catch (error) {
      toast.error('Failed to update warehouse status')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      const result = await deleteWarehouse(warehouse.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Warehouse deleted')
        setShowDeleteDialog(false)
      }
    } catch (error) {
      toast.error('Failed to delete warehouse')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={isLoading}
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => router.push(`/warehouses/${warehouse.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>

          {!warehouse.is_default && warehouse.active && (
            <DropdownMenuItem onClick={handleSetDefault}>
              <Star className="mr-2 h-4 w-4" />
              Set as Default
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => router.push(`/inventory?warehouse=${warehouse.id}`)}
          >
            <Package className="mr-2 h-4 w-4" />
            View Inventory
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {!warehouse.is_default && (
            <DropdownMenuItem onClick={handleToggleStatus}>
              <Power className="mr-2 h-4 w-4" />
              {warehouse.active ? 'Deactivate' : 'Activate'}
            </DropdownMenuItem>
          )}

          {!warehouse.is_default && warehouse.inventory_count === 0 && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the warehouse &quot;{warehouse.name}&quot;. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}