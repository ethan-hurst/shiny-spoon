// PRP-016: Data Accuracy Monitor - Discrepancy Table Component
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, Eye, MoreHorizontal, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Discrepancy } from '@/lib/monitoring/types'

interface DiscrepancyTableProps {
  discrepancies: Discrepancy[]
  onResolve: (id: string) => Promise<void>
}

/**
 * Displays a table of data discrepancies with interactive controls for resolving individual discrepancies.
 *
 * Renders a summary table showing entity, field, type, severity, detection time, status, and actions for each discrepancy. If no discrepancies are present, displays a message indicating data is in sync. Provides a "Mark Resolved" action for each discrepancy, disabling controls while resolution is in progress. If more than 10 discrepancies exist, includes a link to view all discrepancies.
 *
 * @param discrepancies - The list of discrepancies to display in the table.
 * @param onResolve - Callback invoked when a discrepancy is marked as resolved.
 */
export function DiscrepancyTable({
  discrepancies,
  onResolve,
}: DiscrepancyTableProps) {
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set())

  const handleResolve = async (id: string) => {
    setResolvingIds((prev) => new Set(prev).add(id))
    try {
      await onResolve(id)
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const getSeverityColor = (
    severity: string
  ): 'destructive' | 'secondary' | 'outline' | 'default' => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'default'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'missing':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'mismatch':
        return <Eye className="h-4 w-4 text-yellow-500" />
      case 'stale':
        return <div className="h-4 w-4 rounded-full bg-gray-400" />
      default:
        return null
    }
  }

  if (discrepancies.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
        <p>No active discrepancies found!</p>
        <p className="text-sm mt-1">Your data is in sync.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entity</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Detected</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {discrepancies.map((discrepancy) => (
            <TableRow key={discrepancy.id}>
              <TableCell className="font-medium">
                <div>
                  <p className="text-sm">{discrepancy.entity_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {discrepancy.entity_id.slice(0, 8)}...
                  </p>
                </div>
              </TableCell>
              <TableCell>{discrepancy.field_name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getTypeIcon(discrepancy.discrepancy_type)}
                  <span className="capitalize">
                    {discrepancy.discrepancy_type}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={getSeverityColor(discrepancy.severity)}>
                  {discrepancy.severity}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(discrepancy.detected_at), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {discrepancy.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={resolvingIds.has(discrepancy.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleResolve(discrepancy.id)}
                      disabled={resolvingIds.has(discrepancy.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Resolved
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {discrepancies.length > 10 && (
        <div className="text-center">
          <Link href="/monitoring/discrepancies">
            <Button variant="outline" size="sm">
              View All Discrepancies
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
