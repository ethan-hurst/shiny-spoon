'use client'

import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ArrowUpDown, 
  MoreHorizontal, 
  Package, 
  AlertTriangle,
  Download,
  Upload,
  History,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { 
  InventoryWithRelations, 
  calculateAvailableQuantity, 
  isLowStock, 
  isOutOfStock 
} from '@/types/inventory.types'
import { AdjustmentDialog } from './adjustment-dialog'
import { BulkUploadDialog } from './bulk-upload-dialog'
import { ExportButton } from './export-button'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useInventoryRealtime } from '@/hooks/use-inventory'
import { useOptimisticInventory } from '@/hooks/use-optimistic-inventory'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface InventoryTableOptimisticProps {
  initialData: InventoryWithRelations[]
  organizationId: string
}

export const InventoryTableOptimistic = React.memo(function InventoryTableOptimistic({ 
  initialData, 
  organizationId 
}: InventoryTableOptimisticProps) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [adjustmentOpen, setAdjustmentOpen] = React.useState(false)
  const [bulkUploadOpen, setBulkUploadOpen] = React.useState(false)
  const [selectedInventory, setSelectedInventory] = React.useState<InventoryWithRelations | null>(null)

  // Use optimistic inventory hook
  const {
    inventory,
    updateInventory,
    getItemStatus,
    hasPendingUpdates,
    getPendingCount
  } = useOptimisticInventory(initialData)

  // Memoize callback functions for real-time updates
  const handleUpdate = React.useCallback((payload: any) => {
    // Real-time updates are handled by the optimistic hook
    // This ensures server changes are reflected
    router.refresh()
  }, [router])

  const handleInsert = React.useCallback((payload: any) => {
    router.refresh()
  }, [router])

  const handleDelete = React.useCallback((payload: any) => {
    router.refresh()
  }, [router])

  // Set up real-time subscriptions
  useInventoryRealtime({
    organizationId,
    onUpdate: handleUpdate,
    onInsert: handleInsert,
    onDelete: handleDelete,
  })

  // Helper to get sync status icon
  const getSyncStatusIcon = (itemId: string) => {
    const status = getItemStatus(itemId)
    
    switch (status) {
      case 'pending':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Clock className="h-3 w-3 text-yellow-500 animate-pulse" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Syncing changes...</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      case 'confirmed':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Update confirmed</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      default:
        return null
    }
  }

  // Memoize columns definition to prevent unnecessary re-renders
  const columns: ColumnDef<InventoryWithRelations>[] = React.useMemo(() => [
    {
      accessorKey: 'product.sku',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            SKU
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.original.product.sku}</div>
      ),
    },
    {
      accessorKey: 'product.name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Product Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate">{row.original.product.name}</div>
      ),
    },
    {
      accessorKey: 'warehouse.name',
      header: 'Warehouse',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.warehouse.name}</Badge>
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            On Hand
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const quantity = row.original.quantity || 0
        const outOfStock = isOutOfStock(row.original)
        const syncStatus = getSyncStatusIcon(row.original.id)
        
        return (
          <div className="flex items-center gap-2">
            <div className={cn(
              'font-medium',
              outOfStock && 'text-red-600'
            )}>
              {quantity.toLocaleString()}
            </div>
            {syncStatus}
          </div>
        )
      },
    },
    {
      accessorKey: 'reserved_quantity',
      header: 'Reserved',
      cell: ({ row }) => {
        const reserved = row.original.reserved_quantity || 0
        const syncStatus = getSyncStatusIcon(row.original.id)
        
        return (
          <div className="flex items-center gap-2">
            {reserved > 0 ? (
              <div className="text-muted-foreground">{reserved.toLocaleString()}</div>
            ) : (
              <div className="text-muted-foreground">-</div>
            )}
            {syncStatus}
          </div>
        )
      },
    },
    {
      id: 'available',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Available
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      accessorFn: (row) => calculateAvailableQuantity(row),
      cell: ({ row }) => {
        const available = calculateAvailableQuantity(row.original)
        const lowStock = isLowStock(row.original)
        const outOfStock = isOutOfStock(row.original)
        
        return (
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-medium',
              outOfStock && 'text-red-600',
              !outOfStock && lowStock && 'text-yellow-600'
            )}>
              {available.toLocaleString()}
            </span>
            {(lowStock || outOfStock) && (
              <AlertTriangle className={cn(
                'h-4 w-4',
                outOfStock ? 'text-red-600' : 'text-yellow-600'
              )} />
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'reorder_point',
      header: 'Reorder Point',
      cell: ({ row }) => {
        const reorderPoint = row.original.reorder_point || 0
        const syncStatus = getSyncStatusIcon(row.original.id)
        
        return (
          <div className="flex items-center gap-2">
            {reorderPoint > 0 ? (
              <div>{reorderPoint.toLocaleString()}</div>
            ) : (
              <div className="text-muted-foreground">-</div>
            )}
            {syncStatus}
          </div>
        )
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const inventory = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedInventory(inventory)
                  setAdjustmentOpen(true)
                }}
              >
                <Package className="mr-2 h-4 w-4" />
                Adjust Quantity
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/inventory/${inventory.id}/history`)}
              >
                <History className="mr-2 h-4 w-4" />
                View History
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(inventory.product.sku)}
              >
                Copy SKU
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [getSyncStatusIcon, setSelectedInventory, setAdjustmentOpen])

  // Memoize table configuration
  const table = useReactTable({
    data: inventory,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  // Virtual scrolling setup
  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const { rows } = table.getRowModel()
  
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 53,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0

  // Handle adjustment success with optimistic update
  const handleAdjustmentSuccess = React.useCallback(async (inventoryId: string, newQuantity: number) => {
    await updateInventory(inventoryId, { quantity: newQuantity })
    setAdjustmentOpen(false)
  }, [updateInventory])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by SKU or product name..."
            value={(table.getColumn('product.sku')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('product.sku')?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
          {hasPendingUpdates() && (
            <Badge variant="secondary" className="animate-pulse">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {getPendingCount()} pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton 
            filters={columnFilters}
            organizationId={organizationId}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkUploadOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Update
          </Button>
        </div>
      </div>

      <div 
        ref={tableContainerRef}
        className="rounded-md border h-[600px] overflow-auto"
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    getItemStatus(row.original.id) === 'pending' && 'opacity-70'
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} />
              </tr>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {selectedInventory && (
        <AdjustmentDialog
          inventory={selectedInventory}
          open={adjustmentOpen}
          onOpenChange={setAdjustmentOpen}
          onSuccess={() => handleAdjustmentSuccess(selectedInventory.id, selectedInventory.quantity)}
        />
      )}

      <BulkUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onSuccess={() => {
          router.refresh()
          setBulkUploadOpen(false)
        }}
      />
    </div>
  )
})