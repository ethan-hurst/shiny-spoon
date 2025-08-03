'use client'

import { useState } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  MoreHorizontal, 
  Play, 
  Edit, 
  Calendar, 
  Share2, 
  Download, 
  Trash2,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import type { Report } from '@/types/reports.types'

interface ReportsTableProps {
  reports: Report[]
  showSchedule?: boolean
  onRun?: (reportId: string) => void
  onSchedule?: (reportId: string) => void
  onShare?: (reportId: string) => void
  onExport?: (reportId: string, format: 'csv' | 'excel' | 'pdf') => void
  onDelete?: (reportId: string) => void
}

export function ReportsTable({
  reports,
  showSchedule = false,
  onRun,
  onSchedule,
  onShare,
  onExport,
  onDelete
}: ReportsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns: ColumnDef<Report>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link 
          href={`/reports/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.getValue('name')}
        </Link>
      ),
    },
    {
      accessorKey: 'last_run_at',
      header: 'Last Run',
      cell: ({ row }) => {
        const lastRun = row.getValue('last_run_at') as string | null
        return lastRun ? (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(lastRun), { addSuffix: true })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Never</span>
        )
      },
    },
    {
      accessorKey: 'run_count',
      header: 'Runs',
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue('run_count') || 0}</span>
      ),
    },
    ...(showSchedule ? [{
      accessorKey: 'schedule_enabled',
      header: 'Schedule',
      cell: ({ row }: any) => {
        const report = row.original as Report
        if (!report.schedule_enabled) {
          return <Badge variant="outline">Manual</Badge>
        }
        return (
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span className="text-sm">{report.schedule_cron}</span>
          </div>
        )
      },
    }] : []),
    {
      accessorKey: 'access_level',
      header: 'Access',
      cell: ({ row }) => {
        const level = row.getValue('access_level') as string
        return (
          <Badge variant={level === 'private' ? 'secondary' : 'default'}>
            {level}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'is_shared',
      header: 'Shared',
      cell: ({ row }) => {
        const isShared = row.getValue('is_shared') as boolean
        return isShared ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-gray-300" />
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const report = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                aria-label="Report actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {onRun && (
                <DropdownMenuItem onClick={() => onRun(report.id)}>
                  <Play className="mr-2 h-4 w-4" />
                  Run Report
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/reports/${report.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {onSchedule && (
                <DropdownMenuItem onClick={() => onSchedule(report.id)}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule
                </DropdownMenuItem>
              )}
              {onShare && (
                <DropdownMenuItem onClick={() => onShare(report.id)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onExport && (
                <>
                  <DropdownMenuItem onClick={() => onExport(report.id, 'pdf')}>
                    <Download className="mr-2 h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExport(report.id, 'excel')}>
                    <Download className="mr-2 h-4 w-4" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExport(report.id, 'csv')}>
                    <Download className="mr-2 h-4 w-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(report.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: reports,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
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
                  No reports found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2">
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
  )
}

export function ReportsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Shared</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-4 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}