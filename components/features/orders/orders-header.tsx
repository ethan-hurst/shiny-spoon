'use client'

import { useState } from 'react'
import { Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateOrderDialog } from './create-order-dialog'
import { exportOrders } from '@/app/actions/orders'
import { toast } from 'sonner'

export function OrdersHeader() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportOrders()
      if (result.success && result.data) {
        // Create download link
        const blob = new Blob([result.data.csv], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.data.filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success(`Exported ${result.data.count} orders`)
      } else {
        toast.error(result.error || 'Export failed')
      }
    } catch (error) {
      toast.error('Failed to export orders')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground mt-2">
            Manage customer orders and track fulfillment
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Order
          </Button>
        </div>
      </div>

      <CreateOrderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  )
}