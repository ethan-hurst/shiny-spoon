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

  // Helper function to sanitize filename
  const sanitizeFilename = (filename: string): string => {
    // Remove any path traversal attempts
    let safe = filename.replace(/[\/\\]/g, '')
    
    // Remove or replace potentially dangerous characters
    // Keep only alphanumeric, spaces, hyphens, underscores, and dots
    safe = safe.replace(/[^a-zA-Z0-9\s\-_.]/g, '')
    
    // Replace multiple spaces with single underscore
    safe = safe.replace(/\s+/g, '_')
    
    // Remove leading/trailing dots and spaces
    safe = safe.replace(/^[\s.]+|[\s.]+$/g, '')
    
    // Limit length to prevent excessively long filenames
    if (safe.length > 100) {
      safe = safe.substring(0, 100)
    }
    
    // Fallback if filename is empty after sanitization
    if (!safe) {
      safe = 'export'
    }
    
    return safe
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setLoading(true)
    try {
      if (format === 'csv') {
        const csvContent = await exportCustomerPrices(customerId)
        
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        
        // Sanitize customer name for safe filename
        const safeCustomerName = sanitizeFilename(customerName)
        const dateStr = new Date().toISOString().split('T')[0]
        const filename = `${safeCustomerName}_prices_${dateStr}.csv`
        
        link.setAttribute('href', url)
        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up the object URL to prevent memory leaks
        URL.revokeObjectURL(url)
        
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