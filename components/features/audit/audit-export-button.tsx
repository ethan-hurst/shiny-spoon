// components/features/audit/audit-export-button.tsx
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
import { exportAuditLogs, generateComplianceReport } from '@/app/actions/audit'

interface AuditExportButtonProps {
  filters: any
  organizationId: string
}

export function AuditExportButton({
  filters,
  organizationId,
}: AuditExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true)

    try {
      const result = await exportAuditLogs({
        organizationId,
        filters,
        format,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.data && result.filename) {
        // Create blob and download
        const blob = new Blob([result.data], {
          type: format === 'csv' ? 'text/csv' : 'application/json',
        })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)

        link.setAttribute('href', url)
        link.setAttribute('download', result.filename)
        link.click()

        URL.revokeObjectURL(url)

        toast.success('Audit logs exported successfully')
      }
    } catch (error) {
      toast.error('Failed to export audit logs')
    } finally {
      setIsExporting(false)
    }
  }

  const handleComplianceReport = async (
    type: 'soc2' | 'iso27001' | 'custom'
  ) => {
    setIsExporting(true)

    try {
      const result = await generateComplianceReport({
        organizationId,
        reportType: type,
        dateRange: {
          from: filters.from,
          to: filters.to,
        },
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Compliance report generated and sent to your email')
    } catch (error) {
      toast.error('Failed to generate compliance report')
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
        <DropdownMenuItem onClick={() => handleExport('json')}>
          <FileText className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleComplianceReport('soc2')}>
          <FileText className="mr-2 h-4 w-4" />
          SOC 2 Compliance Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleComplianceReport('iso27001')}>
          <FileText className="mr-2 h-4 w-4" />
          ISO 27001 Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleComplianceReport('custom')}>
          <FileText className="mr-2 h-4 w-4" />
          Custom Compliance Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
