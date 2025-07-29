// components/features/reports/reports-table.tsx
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
  Copy,
  Edit,
  MoreHorizontal,
  Play,
  Settings,
  Share,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { duplicateReport, deleteReport, runReport } from '@/app/actions/reports'
import type { Report } from '@/types/reports.types'

interface ReportsTableProps {
  reports: (Report & { report_runs?: { count: number }[] })[]
  showSchedule?: boolean
}

export function ReportsTable({ reports, showSchedule = false }: ReportsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [isRunning, setIsRunning] = React.useState<string | null>(null)

  const handleDuplicate = async (reportId: string) => {
    try {
      const result = await duplicateReport(reportId)
      if (result.success) {
        toast.success('Report duplicated successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to duplicate report')
      }
    } catch (error) {
      toast.error('Failed to duplicate report')
    }
  }

  const handleDelete = async (reportId: string, reportName: string) => {
    if (!confirm(`Are you sure you want to delete "${reportName}"?`)) {
      return
    }

    try {
      const result = await deleteReport(reportId)
      if (result.success) {
        toast.success('Report deleted successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to delete report')
      }
    } catch (error) {
      toast.error('Failed to delete report')
    }
  }

  const handleRun = async (reportId: string, reportName: string) => {
    setIsRunning(reportId)
    try {
      const result = await runReport(reportId, 'pdf')
      if (result.success && result.data) {
        // Create and download the file
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename || `${reportName}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success('Report generated successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to run report')
      }
    } catch (error) {
      toast.error('Failed to run report')
    } finally {
      setIsRunning(null)
    }
  }

  const columns: ColumnDef<Report & { report_runs?: { count: number }[] }>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.getValue('name')}</div>
          {row.original.description && (
            <div className="text-sm text-muted-foreground">
              {row.original.description}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'config',
      header: 'Components',
      cell: ({ row }) => {
        const config = row.getValue('config') as any
        const componentCount = config?.components?.length || 0
        return (
          <Badge variant="secondary">
            {componentCount} component{componentCount !== 1 ? 's' : ''}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'last_run_at',
      header: 'Last Run',
      cell: ({ row }) => {
        const lastRun = row.getValue('last_run_at') as string
        return lastRun
          ? format(new Date(lastRun), 'MMM d, yyyy h:mm a')
          : 'Never'
      },
    },
    {
      accessorKey: 'run_count',
      header: 'Runs',
      cell: ({ row }) => row.getValue('run_count') || 0,
    },
    ...(showSchedule
      ? [
          {
            accessorKey: 'schedule_enabled',
            header: 'Schedule',
            cell: ({ row }: any) => {
              const enabled = row.getValue('schedule_enabled')
              const cron = row.original.schedule_cron
              return enabled ? (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {cron || 'Scheduled'}
                </Badge>
              ) : (
                <Badge variant="secondary">Manual</Badge>
              )
            },
          } as ColumnDef<Report & { report_runs?: { count: number }[] }>,
        ]
      : []),
    {
      accessorKey: 'access_level',
      header: 'Access',
      cell: ({ row }) => {
        const level = row.getValue('access_level') as string
        const colors = {
          private: 'bg-gray-100 text-gray-800',
          team: 'bg-blue-100 text-blue-800',
          organization: 'bg-green-100 text-green-800',
        }
        return (
          <Badge variant="secondary" className={colors[level as keyof typeof colors]}>
            {level}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => {
        const date = row.getValue('created_at') as string
        return format(new Date(date), 'MMM d, yyyy')
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const report = row.original
        const isLoading = isRunning === report.id

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleRun(report.id, report.name)}
                disabled={isLoading}
              >
                <Play className="mr-2 h-4 w-4" />
                Run Report
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/reports/${report.id}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDuplicate(report.id)}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/reports/${report.id}/schedule`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Schedule
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/reports/${report.id}/share`}>
                  <Share className="mr-2 h-4 w-4" />
                  Share
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDelete(report.id, report.name)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: reports,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search reports..."
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm"
        />
      </div>

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
                  No reports found. Create your first report to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
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