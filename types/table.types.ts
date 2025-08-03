import React from 'react'

export interface Column<T> {
  id: keyof T | string
  header: string
  accessor: (row: T) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
}

export interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
}
