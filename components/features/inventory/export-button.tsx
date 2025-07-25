'use client'

import { useState } from 'react'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { exportInventory } from '@/app/actions/inventory'

interface ExportButtonProps {
  filters?: ColumnFiltersState
}

export function ExportButton({ filters }: ExportButtonProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)

    try {
      // Convert table filters to export filters
      const exportFilters = {
        search: filters?.find((f) => f.id === 'product.sku')?.value as string,
        // Add other filter mappings as needed
      }

      const result = await exportInventory(exportFilters)

      if (result.error) {
        toast({
          title: 'Export failed',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      if (result.csv && result.filename) {
        // Create blob and download
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)

        link.setAttribute('href', url)
        link.setAttribute('download', result.filename)
        link.style.display = 'none'

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100)

        toast({
          title: 'Export successful',
          description: `Exported ${result.rowCount} inventory items`,
        })
      }
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Export failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      aria-label="Export inventory data to CSV"
    >
      {isExporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Export CSV
        </>
      )}
    </Button>
  )
}
