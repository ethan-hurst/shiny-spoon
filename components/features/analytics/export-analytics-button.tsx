// PRP-018: Analytics Dashboard - Export Analytics Button Component
'use client'

import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DateRange } from '@/lib/analytics/calculate-metrics'
import { exportAnalytics } from '@/app/actions/analytics'

interface ExportAnalyticsButtonProps {
  dateRange: DateRange
  organizationId: string
}

export function ExportAnalyticsButton({
  dateRange,
  organizationId,
}: ExportAnalyticsButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: 'csv' | 'pdf') => {
    setIsExporting(true)

    try {
      const result = await exportAnalytics({
        organizationId,
        dateRange,
        format,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.data && result.filename) {
        // Create blob and download
        const blob = new Blob([result.data], {
          type: format === 'csv' ? 'text/csv' : 'application/pdf',
        })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)

        link.setAttribute('href', url)
        link.setAttribute('download', result.filename)
        link.click()

        URL.revokeObjectURL(url)

        toast.success('Export completed successfully')
      }
    } catch (error) {
      toast.error('Failed to export analytics')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="mr-2 h-4 w-4" />
          Export as PDF Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
