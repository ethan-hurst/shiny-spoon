'use client'

import { useState } from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table'
import { Building2, MapPin, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { WarehouseWithDetails } from '@/types/warehouse.types'
import { WarehouseActions } from './warehouse-actions'
import { WarehouseFilters } from './warehouse-filters'

interface WarehousesTableProps {
  initialData: WarehouseWithDetails[]
  states: string[]
}

export function WarehousesTable({ initialData, states }: WarehousesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  const columns: ColumnDef<WarehouseWithDetails>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }) => {
        const warehouse = row.original
        return (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{warehouse.code}</span>
            {warehouse.is_default && (
              <Badge variant="secondary" className="text-xs">
                Default
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => row.getValue('name'),
    },
    {
      id: 'address',
      header: 'Location',
      cell: ({ row }) => {
        const warehouse = row.original
        const address = warehouse.address as any
        if (!address) return null

        return (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <div>
                {address.city}, {address.state}
              </div>
              <div className="text-muted-foreground">{address.country}</div>
            </div>
          </div>
        )
      },
    },
    {
      id: 'contact',
      header: 'Primary Contact',
      cell: ({ row }) => {
        const warehouse = row.original
        const contacts = warehouse.contact as any[]
        const primaryContact = contacts?.find((c) => c.isPrimary)

        if (!primaryContact) return null

        return (
          <div className="flex items-start gap-2">
            <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <div>{primaryContact.name}</div>
              <div className="text-muted-foreground">{primaryContact.role}</div>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'inventory_count',
      header: 'Inventory Items',
      cell: ({ row }) => {
        const count = row.getValue('inventory_count') as number
        return (
          <div className="text-center">
            <span className="font-medium">{count}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.getValue('active') as boolean
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        return <WarehouseActions warehouse={row.original} />
      },
    },
  ]

  const table = useReactTable({
    data: initialData,
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

  return (
    <div className="space-y-4">
      <WarehouseFilters table={table} states={states} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No warehouses found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of{' '}
          {table.getCoreRowModel().rows.length} warehouse(s)
        </div>
        <div className="space-x-2">
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
    </div>
  )
}
