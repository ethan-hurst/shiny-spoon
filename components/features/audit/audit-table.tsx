// components/features/audit/audit-table.tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
} from '@tanstack/react-table'
import { format } from 'date-fns'
import {
  ChevronDown,
  Eye,
  FileEdit,
  LogIn,
  LogOut,
  Package,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface AuditLog {
  id: string
  user_id: string
  user_email: string
  user_name?: string
  user_avatar?: string
  user_role?: string
  action: string
  entity_type: string
  entity_id?: string
  entity_name?: string
  old_values?: any
  new_values?: any
  metadata?: any
  ip_address?: string
  user_agent?: string
  created_at: string
}

interface AuditTableProps {
  logs: AuditLog[]
  totalCount: number
  currentPage: number
  filters: any
}

const actionIcons = {
  create: UserPlus,
  update: FileEdit,
  delete: Trash2,
  view: Eye,
  login: LogIn,
  logout: LogOut,
  export: Package,
}

const actionColors = {
  create: 'bg-green-500/10 text-green-700 dark:text-green-400',
  update: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  delete: 'bg-red-500/10 text-red-700 dark:text-red-400',
  view: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  login: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  logout: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  export: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
}

export function AuditTable({
  logs,
  totalCount,
  currentPage,
  filters,
}: AuditTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [rowSelection, setRowSelection] = React.useState({})

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: 'created_at',
      header: 'Time',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="font-medium">
            {format(new Date(row.getValue('created_at')), 'MMM d, yyyy')}
          </div>
          <div className="text-muted-foreground">
            {format(new Date(row.getValue('created_at')), 'h:mm:ss a')}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'user',
      header: 'User',
      cell: ({ row }) => {
        const log = row.original
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={log.user_avatar} />
              <AvatarFallback>
                {log.user_name?.charAt(0) || log.user_email.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <div className="font-medium">
                {log.user_name || log.user_email}
              </div>
              {log.user_role && (
                <div className="text-xs text-muted-foreground">
                  {log.user_role}
                </div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => {
        const action = row.getValue('action') as string
        const Icon = actionIcons[action as keyof typeof actionIcons] || FileEdit

        return (
          <Badge
            variant="secondary"
            className={cn(
              'gap-1',
              actionColors[action as keyof typeof actionColors]
            )}
          >
            <Icon className="h-3 w-3" />
            {action}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'entity',
      header: 'Entity',
      cell: ({ row }) => {
        const log = row.original
        return (
          <div className="text-sm">
            <div className="font-medium">{log.entity_type}</div>
            {log.entity_name && (
              <div className="text-muted-foreground truncate max-w-[200px]">{log.entity_name}</div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'details',
      header: 'Details',
      cell: ({ row }) => {
        const log = row.original
        const changes = getChangeSummary(log)

        return (
          <div className="text-sm max-w-xs">
            {changes.length > 0 ? (
              <ul className="space-y-1">
                {changes.slice(0, 2).map((change, i) => (
                  <li key={i} className="truncate text-muted-foreground">
                    {change}
                  </li>
                ))}
                {changes.length > 2 && (
                  <li className="text-muted-foreground">
                    +{changes.length - 2} more changes
                  </li>
                )}
              </ul>
            ) : (
              <span className="text-muted-foreground">
                {log.metadata?.description || 'No details available'}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const log = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/audit/${log.id}`)}>
                View full details
              </DropdownMenuItem>
              {log.entity_id && log.entity_type && (
                <DropdownMenuItem asChild>
                  <Link href={`/${log.entity_type}/${log.entity_id}`}>
                    View {log.entity_type}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => copyToClipboard(log)}>
                Copy details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: logs,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  })

  const totalPages = Math.ceil(totalCount / 50)

  return (
    <div className="space-y-4">
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
                  No audit logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={buildPageUrl(currentPage - 1, filters)}
                className={
                  currentPage <= 1 ? 'pointer-events-none opacity-50' : ''
                }
              />
            </PaginationItem>

            {generatePaginationItems(currentPage, totalPages).map((page, i) => (
              <PaginationItem key={i}>
                {page === '...' ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href={buildPageUrl(page as number, filters)}
                    isActive={currentPage === page}
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                href={buildPageUrl(currentPage + 1, filters)}
                className={
                  currentPage >= totalPages
                    ? 'pointer-events-none opacity-50'
                    : ''
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}

function getChangeSummary(log: AuditLog): string[] {
  const changes: string[] = []

  if (!log.old_values || !log.new_values) return changes

  Object.keys(log.new_values).forEach((key) => {
    if (log.old_values[key] !== log.new_values[key]) {
      changes.push(`${key}: ${log.old_values[key]} → ${log.new_values[key]}`)
    }
  })

  return changes
}

function copyToClipboard(log: AuditLog) {
  const details = `
Time: ${format(new Date(log.created_at), 'PPpp')}
User: ${log.user_name || log.user_email} (${log.user_role})
Action: ${log.action}
Entity: ${log.entity_type} - ${log.entity_name || log.entity_id || 'N/A'}
IP: ${log.ip_address || 'N/A'}
${log.old_values && log.new_values ? 'Changes: ' + getChangeSummary(log).join(', ') : ''}
  `.trim()

  navigator.clipboard.writeText(details)
}

function buildPageUrl(page: number, filters: any): string {
  const params = new URLSearchParams()

  if (filters.user_id) params.set('user', filters.user_id)
  if (filters.action) params.set('action', filters.action)
  if (filters.entity_type) params.set('entity', filters.entity_type)
  if (filters.from) params.set('from', filters.from.toISOString().split('T')[0])
  if (filters.to) params.set('to', filters.to.toISOString().split('T')[0])
  params.set('page', page.toString())

  return `/audit?${params.toString()}`
}

function generatePaginationItems(
  current: number,
  total: number
): (number | string)[] {
  const items: (number | string)[] = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      items.push(i)
    }
  } else {
    items.push(1)

    if (current > 3) items.push('...')

    for (
      let i = Math.max(2, current - 1);
      i <= Math.min(total - 1, current + 1);
      i++
    ) {
      items.push(i)
    }

    if (current < total - 2) items.push('...')

    items.push(total)
  }

  return items
}