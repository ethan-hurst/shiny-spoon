'use client'

import React from 'react'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  Percent,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { bulkUpdateCustomerPrices } from '@/app/actions/pricing'

interface BulkPriceUpdateDialogProps {
  customerId: string
  selectedProducts?: Array<{
    id: string
    sku: string
    name: string
    currentPrice: number
    basePrice: number
  }>
  onComplete?: () => void
  children?: React.ReactNode
}

type UpdateType = 'percentage' | 'fixed' | 'csv'
type PriceChangeType = 'increase' | 'decrease' | 'override'

interface CSVRow {
  sku: string
  price?: number
  discount_percent?: number
}

export function BulkPriceUpdateDialog({
  customerId,
  selectedProducts = [],
  onComplete,
  children,
}: BulkPriceUpdateDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  // Form state
  const [updateType, setUpdateType] = useState<UpdateType>('percentage')
  const [changeType, setChangeType] = useState<PriceChangeType>('override')
  const [percentageValue, setPercentageValue] = useState('')
  const [fixedValue, setFixedValue] = useState('')
  const [reason, setReason] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [csvData, setCsvData] = useState<CSVRow[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)

  // Preview state
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<
    Array<{
      sku: string
      name: string
      currentPrice: number
      newPrice: number
      changePercent: number
    }>
  >([])

  // Helper function to parse CSV with proper handling of quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i += 2
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
          i++
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim())
        current = ''
        i++
      } else {
        current += char
        i++
      }
    }

    // Add the last field
    result.push(current.trim())
    return result
  }

  // Calculate new price based on update type
  const calculateNewPrice = useCallback(
    (currentPrice: number, basePrice: number) => {
      if (updateType === 'percentage') {
        const percent = parseFloat(percentageValue) / 100
        if (changeType === 'increase') {
          return currentPrice * (1 + percent)
        } else if (changeType === 'decrease') {
          return currentPrice * (1 - percent)
        } else {
          return basePrice * (1 - percent) // Override with discount using base price
        }
      } else if (updateType === 'fixed') {
        const fixed = parseFloat(fixedValue)
        if (changeType === 'increase') {
          return currentPrice + fixed
        } else if (changeType === 'decrease') {
          return currentPrice - fixed
        } else {
          return fixed // Override with fixed price
        }
      }
      return currentPrice
    },
    [updateType, changeType, percentageValue, fixedValue]
  )

  // Generate preview
  const generatePreview = useCallback(() => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the price change')
      return
    }

    const preview = selectedProducts.map((product) => {
      let newPrice = product.currentPrice

      if (updateType === 'csv') {
        const csvRow = csvData.find((row) => row.sku === product.sku)
        if (csvRow) {
          if (csvRow.price !== undefined) {
            newPrice = csvRow.price
          } else if (csvRow.discount_percent !== undefined) {
            newPrice = product.basePrice * (1 - csvRow.discount_percent / 100)
          }
        }
      } else {
        newPrice = calculateNewPrice(product.currentPrice, product.basePrice)
      }

      const changePercent =
        ((newPrice - product.currentPrice) / product.currentPrice) * 100

      return {
        sku: product.sku,
        name: product.name,
        currentPrice: product.currentPrice,
        newPrice,
        changePercent,
      }
    })

    setPreviewData(preview)
    setShowPreview(true)
  }, [selectedProducts, updateType, csvData, calculateNewPrice, reason])

  // Handle CSV file upload
  const handleCSVUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string
          const lines = text.split('\n').filter((line) => line.trim()) // Filter empty lines

          if (lines.length === 0) {
            throw new Error('CSV file is empty')
          }

          const headers = parseCSVLine(lines[0]).map((h: string) =>
            h.toLowerCase().trim()
          )

          if (!headers.includes('sku')) {
            throw new Error('CSV must have a "sku" column')
          }

          const data: CSVRow[] = []
          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i])
            const row: CSVRow = { sku: '' }

            headers.forEach((header, index) => {
              if (header === 'sku') {
                row.sku = values[index]
              } else if (header === 'price') {
                row.price = parseFloat(values[index])
              } else if (
                header === 'discount_percent' ||
                header === 'discount'
              ) {
                row.discount_percent = parseFloat(values[index])
              }
            })

            if (
              row.sku &&
              (row.price !== undefined || row.discount_percent !== undefined)
            ) {
              data.push(row)
            }
          }

          setCsvData(data)
          setCsvError(null)
          toast.success(`Loaded ${data.length} price updates from CSV`)
        } catch (error) {
          setCsvError(
            error instanceof Error ? error.message : 'Failed to parse CSV'
          )
          toast.error('Failed to parse CSV file')
        }
      }
      reader.readAsText(file)
    },
    []
  )

  // Apply bulk update
  const handleApply = useCallback(async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the price change')
      return
    }

    setLoading(true)
    setProgress(0)

    try {
      const updates = previewData.map((item) => {
        return {
          sku: item.sku,
          price: item.newPrice,
          reason: reason.trim(),
        }
      })

      const formData = new FormData()
      formData.append('customer_id', customerId)
      formData.append('updates', JSON.stringify(updates))
      formData.append('apply_to_all_warehouses', 'true')

      // Set progress to 50% when starting the API call
      setProgress(50)

      await bulkUpdateCustomerPrices(formData)

      // Set progress to 100% when successful
      setProgress(100)

      toast.success(
        `Successfully updated prices for ${updates.length} products`
      )
      setOpen(false)
      router.refresh()
      onComplete?.()
    } catch (error) {
      console.error('Bulk update error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to update prices'
      )
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }, [previewData, reason, customerId, router, onComplete])

  // Reset form
  const resetForm = useCallback(() => {
    setUpdateType('percentage')
    setChangeType('override')
    setPercentageValue('')
    setFixedValue('')
    setReason('')
    setRequiresApproval(false)
    setCsvData([])
    setCsvError(null)
    setShowPreview(false)
    setPreviewData([])
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open)
        if (!open) resetForm()
      }}
    >
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Update Prices
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Price Update</DialogTitle>
          <DialogDescription>
            Update prices for {selectedProducts.length} selected products
          </DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-6 py-4">
            {/* Update type selection */}
            <div className="space-y-4">
              <Label>Update Method</Label>
              <RadioGroup
                value={updateType}
                onValueChange={(v) => setUpdateType(v as UpdateType)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="percentage" />
                  <Label
                    htmlFor="percentage"
                    className="flex items-center cursor-pointer"
                  >
                    <Percent className="h-4 w-4 mr-2" />
                    Percentage Change
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label
                    htmlFor="fixed"
                    className="flex items-center cursor-pointer"
                  >
                    Fixed Amount
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label
                    htmlFor="csv"
                    className="flex items-center cursor-pointer"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Upload CSV
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Percentage update */}
            {updateType === 'percentage' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Change Type</Label>
                    <Select
                      value={changeType}
                      onValueChange={(v) => setChangeType(v as PriceChangeType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increase">
                          Increase Prices
                        </SelectItem>
                        <SelectItem value="decrease">
                          Decrease Prices
                        </SelectItem>
                        <SelectItem value="override">Set Discount %</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Percentage</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="10"
                        value={percentageValue}
                        onChange={(e) => setPercentageValue(e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fixed amount update */}
            {updateType === 'fixed' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Change Type</Label>
                    <Select
                      value={changeType}
                      onValueChange={(v) => setChangeType(v as PriceChangeType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increase">
                          Increase by Amount
                        </SelectItem>
                        <SelectItem value="decrease">
                          Decrease by Amount
                        </SelectItem>
                        <SelectItem value="override">
                          Set Fixed Price
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={fixedValue}
                        onChange={(e) => setFixedValue(e.target.value)}
                        min="0"
                        step="0.01"
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CSV upload */}
            {updateType === 'csv' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6">
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Upload CSV file</p>
                        <p className="text-sm text-muted-foreground">
                          Must contain columns: sku, price (or discount_percent)
                        </p>
                      </div>
                    </div>
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      className="sr-only"
                      onChange={handleCSVUpload}
                    />
                  </Label>
                </div>

                {csvError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{csvError}</AlertDescription>
                  </Alert>
                )}

                {csvData.length > 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Loaded {csvData.length} price updates from CSV
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Reason for change */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Change *</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Seasonal promotion, Contract negotiation, Market adjustment..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {/* Additional options */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="approval"
                checked={requiresApproval}
                onCheckedChange={(checked) =>
                  setRequiresApproval(checked as boolean)
                }
              />
              <Label htmlFor="approval" className="cursor-pointer">
                Require approval for prices below margin threshold
              </Label>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Preview header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Preview Changes</h3>
                <p className="text-sm text-muted-foreground">
                  Review the price changes before applying
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(false)}
              >
                Back to Edit
              </Button>
            </div>

            {/* Reason display */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Reason:</strong> {reason}
              </AlertDescription>
            </Alert>

            {/* Preview table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2 text-sm font-medium">
                        Product
                      </th>
                      <th className="text-right p-2 text-sm font-medium">
                        Current
                      </th>
                      <th className="text-right p-2 text-sm font-medium">
                        New
                      </th>
                      <th className="text-right p-2 text-sm font-medium">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((item, index) => (
                      <tr key={item.sku} className="border-t">
                        <td className="p-2">
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.sku}
                            </p>
                          </div>
                        </td>
                        <td className="text-right p-2 text-sm">
                          {formatCurrency(item.currentPrice)}
                        </td>
                        <td className="text-right p-2 text-sm font-medium">
                          {formatCurrency(item.newPrice)}
                        </td>
                        <td className="text-right p-2">
                          <Badge
                            variant={
                              item.changePercent > 0 ? 'destructive' : 'default'
                            }
                            className={`text-xs ${item.changePercent <= 0 ? 'bg-green-100 text-green-800' : ''}`}
                          >
                            {item.changePercent > 0 ? '+' : ''}
                            {formatPercent(item.changePercent)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Products</p>
                  <p className="font-semibold">{previewData.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price Increases</p>
                  <p className="font-semibold text-red-600">
                    {previewData.filter((p) => p.changePercent > 0).length}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price Decreases</p>
                  <p className="font-semibold text-green-600">
                    {previewData.filter((p) => p.changePercent < 0).length}
                  </p>
                </div>
              </div>
            </div>

            {loading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  Updating prices... {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          {!showPreview ? (
            <Button
              onClick={generatePreview}
              disabled={
                loading ||
                !reason.trim() ||
                (updateType === 'percentage' &&
                  (!percentageValue ||
                    isNaN(parseFloat(percentageValue)) ||
                    parseFloat(percentageValue) <= 0)) ||
                (updateType === 'fixed' &&
                  (!fixedValue ||
                    isNaN(parseFloat(fixedValue)) ||
                    parseFloat(fixedValue) <= 0)) ||
                (updateType === 'csv' && csvData.length === 0)
              }
            >
              Preview Changes
            </Button>
          ) : (
            <Button onClick={handleApply} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>Apply Changes</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
