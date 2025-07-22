'use client'

import { Table } from '@tanstack/react-table'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface WarehouseFiltersProps<TData> {
  table: Table<TData>
  states: string[]
}

export function WarehouseFilters<TData>({
  table,
  states,
}: WarehouseFiltersProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search warehouses..."
            value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('name')?.setFilterValue(event.target.value)
            }
            className="pl-8"
          />
        </div>

        <Select
          value={
            (table.getColumn('active')?.getFilterValue() as string) ?? 'all'
          }
          onValueChange={(value) => {
            if (value === 'all') {
              table.getColumn('active')?.setFilterValue(undefined)
            } else {
              table.getColumn('active')?.setFilterValue(value === 'true')
            }
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="true">Active only</SelectItem>
            <SelectItem value="false">Inactive only</SelectItem>
          </SelectContent>
        </Select>

        {states.length > 0 && (
          <Select
            value="all"
            onValueChange={(value) => {
              if (value === 'all') {
                table.resetColumnFilters()
              } else {
                // Custom filter for address.state
                table.setGlobalFilter((old: any) => ({
                  ...old,
                  state: value,
                }))
              }
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {states.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
