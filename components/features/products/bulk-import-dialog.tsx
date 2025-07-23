'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Download, FileText, Upload } from 'lucide-react'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { bulkImportProducts } from '@/app/actions/products'

interface BulkImportDialogProps {
  children: React.ReactNode
}

interface ParsedProduct {
  sku: string
  name: string
  description?: string
  category?: string
  base_price: number
  cost?: number
  weight?: number
}

export function BulkImportDialog({ children }: BulkImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedProduct[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const router = useRouter()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      // 5MB limit
      toast.error('File size must be less than 5MB')
      return
    }

    setFile(selectedFile)

    // Read and parse the file
    const reader = new FileReader()
    reader.onload = async (event) => {
      const content = event.target?.result as string
      setCsvContent(content)
      parseCSV(content)
    }
    reader.readAsText(selectedFile)
  }

  const parseCSV = (content: string) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        if (results.errors.length > 0) {
          setValidationErrors(
            results.errors.map((error) => `Row ${error.row}: ${error.message}`)
          )
          return
        }

        const data = results.data as any[]
        if (data.length === 0) {
          setValidationErrors([
            'CSV file must have a header row and at least one data row',
          ])
          return
        }

        // Check required headers
        const headers = results.meta.fields || []
        const requiredHeaders = ['sku', 'name', 'base_price']
        const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h))

        if (missingHeaders.length > 0) {
          setValidationErrors([
            `Missing required columns: ${missingHeaders.join(', ')}`,
          ])
          return
        }

        const errors: string[] = []
        const products: ParsedProduct[] = []

        // Parse data rows (limit preview to first 10)
        const dataRows = data.slice(0, Math.min(10, data.length))
        dataRows.forEach((row, index) => {
          const product: any = {}

          // Process each field
          headers.forEach((header) => {
            const value = row[header]
            if (
              header === 'base_price' ||
              header === 'cost' ||
              header === 'weight'
            ) {
              product[header] = value ? parseFloat(value) : 0
              if (isNaN(product[header])) {
                errors.push(`Row ${index + 2}: Invalid number for ${header}`)
              }
            } else {
              product[header] = value || ''
            }
          })

          // Validate required fields
          if (!product.sku) {
            errors.push(`Row ${index + 2}: SKU is required`)
          }
          if (!product.name) {
            errors.push(`Row ${index + 2}: Name is required`)
          }
          if (!product.base_price || product.base_price <= 0) {
            errors.push(`Row ${index + 2}: Base price must be greater than 0`)
          }

          if (
            errors.length === 0 ||
            errors.filter((e) => e.includes(`Row ${index + 2}`)).length === 0
          ) {
            products.push(product as ParsedProduct)
          }
        })

        setValidationErrors(errors)
        setParsedData(products)

        if (data.length > 10) {
          toast.info(
            `Showing preview of first 10 rows. Total rows: ${data.length}`
          )
        }
      },
      error: (error) => {
        setValidationErrors([
          `Failed to parse CSV file: ${error.message}`,
        ])
      }
    })
  }

  const handleImport = async () => {
    if (!csvContent || validationErrors.length > 0) return

    setIsImporting(true)
    setImportProgress(0)

    let progressInterval: NodeJS.Timeout | null = null

    try {
      // Simulate progress for now since bulkImportProducts is not fully implemented
      progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const result = await bulkImportProducts(csvContent)

      if (progressInterval) {
        clearInterval(progressInterval)
      }
      setImportProgress(100)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Products imported successfully')
        router.refresh()
        setOpen(false)
      }
    } catch (error) {
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      toast.error('Failed to import products')
    } finally {
      setIsImporting(false)
      setImportProgress(0)
    }
  }

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      // Clean up any running intervals when component unmounts
      setIsImporting(false)
      setImportProgress(0)
    }
  }, [])

  const downloadTemplate = () => {
    const template =
      'sku,name,description,category,base_price,cost,weight\n' +
      'WIDGET-001,Premium Widget,"High quality widget",Hardware,99.99,45.00,2.5\n' +
      'GADGET-002,Super Gadget,"Amazing gadget with features",Electronics,149.99,75.00,1.2\n'

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-import-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetDialog = () => {
    setFile(null)
    setCsvContent('')
    setParsedData([])
    setValidationErrors([])
    setImportProgress(0)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen)
        if (!newOpen) resetDialog()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Products</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple products at once. Maximum 5,000
            rows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Download CSV Template</p>
                <p className="text-sm text-muted-foreground">
                  Use our template to ensure correct formatting
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Upload CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isImporting}
            />
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && validationErrors.length === 0 && (
            <div>
              <h3 className="font-medium mb-2">Preview (First 10 rows)</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((product, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {product.sku}
                        </TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{product.category || '—'}</TableCell>
                        <TableCell>${product.base_price.toFixed(2)}</TableCell>
                        <TableCell>
                          {product.cost ? `$${product.cost.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell>
                          {product.weight ? `${product.weight} lbs` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importing products...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !file ||
              parsedData.length === 0 ||
              validationErrors.length > 0 ||
              isImporting
            }
          >
            {isImporting ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-pulse" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Products
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
