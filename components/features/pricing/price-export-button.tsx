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
import { exportCustomerPrices } from '@/app/actions/customer-pricing'

interface PriceExportButtonProps {
  customerId: string
  customerName?: string
}

export function PriceExportButton({
  customerId,
  customerName = 'Customer',
}: PriceExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setLoading(true)
    try {
      if (format === 'csv') {
        const csvContent = await exportCustomerPrices(customerId)

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)

        link.setAttribute('href', url)
        link.setAttribute(
          'download',
          `${customerName.replace(/\s+/g, '_')}_prices_${new Date().toISOString().split('T')[0]}.csv`
        )
        link.style.visibility = 'hidden'

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast.success('Price sheet exported successfully')
      } else {
        toast.info(`${format.toUpperCase()} export coming soon`)
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export price sheet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
