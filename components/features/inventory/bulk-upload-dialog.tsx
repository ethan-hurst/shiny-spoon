'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  FileUp, 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertCircle
} from 'lucide-react'
import { bulkUpdateInventory } from '@/app/actions/inventory'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { parseInventoryCSV, validateCSVFile } from '@/lib/csv/parser'
import { downloadTemplate, TEMPLATE_DESCRIPTIONS } from '@/lib/csv/templates'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  onSuccess
}: BulkUploadDialogProps) {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    successCount: number
    errorCount: number
    errors?: string[]
  } | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    const validation = validateCSVFile(selectedFile)
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error,
        variant: 'destructive',
      })
      return
    }

    setFile(selectedFile)
    setUploadResult(null)
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setUploadResult(null)

    try {
      const csvContent = await file.text()
      
      // Parse CSV first to validate
      const parseResult = parseInventoryCSV(csvContent)
      
      if (parseResult.errors.length > 0) {
        toast({
          title: 'CSV validation failed',
          description: `Found ${parseResult.errors.length} error(s) in the CSV file`,
          variant: 'destructive',
        })
        setUploadResult({
          successCount: 0,
          errorCount: parseResult.errors.length,
          errors: parseResult.errors.slice(0, 10).map(err => 
            `Row ${err.row}: ${err.column ? `${err.column} - ` : ''}${err.message}`
          ),
        })
        return
      }
      
      if (parseResult.warnings.length > 0) {
        parseResult.warnings.forEach(warning => {
          toast({
            title: 'Warning',
            description: warning,
          })
        })
      }
      
      // Proceed with upload
      const result = await bulkUpdateInventory(csvContent)

      if (result.error && !result.successCount) {
        toast({
          title: 'Upload failed',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        setUploadResult({
          successCount: result.successCount,
          errorCount: result.errorCount,
          errors: result.errors,
        })

        if (result.successCount > 0) {
          toast({
            title: 'Upload completed',
            description: `Successfully updated ${result.successCount} items${
              result.errorCount > 0 ? `, ${result.errorCount} errors` : ''
            }`,
          })
          
          if (result.errorCount === 0) {
            setTimeout(() => {
              onSuccess()
              handleClose()
            }, 2000)
          }
        }
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setUploadResult(null)
    onOpenChange(false)
  }

  const handleTemplateDownload = (templateKey: keyof typeof TEMPLATE_DESCRIPTIONS) => {
    downloadTemplate(templateKey)
    toast({
      title: 'Template downloaded',
      description: 'Check your downloads folder for the CSV template',
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Update Inventory</DialogTitle>
          <DialogDescription>
            Upload a CSV file to update multiple inventory items at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Download a template to see the required format</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Templates
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[250px]">
                    {Object.entries(TEMPLATE_DESCRIPTIONS).map(([key, template]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => handleTemplateDownload(key as keyof typeof TEMPLATE_DESCRIPTIONS)}
                        className="flex flex-col items-start py-2"
                      >
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {template.useCase}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div>
            <label
              htmlFor="csv-upload"
              className={cn(
                'flex flex-col items-center justify-center w-full h-32',
                'border-2 border-dashed rounded-lg cursor-pointer',
                'hover:bg-muted/50 transition-colors',
                file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              )}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileUp className={cn(
                  'w-8 h-8 mb-2',
                  file ? 'text-primary' : 'text-muted-foreground'
                )} />
                <p className="mb-2 text-sm text-center">
                  {file ? (
                    <span className="font-semibold">{file.name}</span>
                  ) : (
                    <>
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </>
                  )}
                </p>
                {!file && (
                  <p className="text-xs text-muted-foreground">CSV files only (max 10MB, 10,000 rows)</p>
                )}
              </div>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>
          </div>

          {/* CSV Format Info */}
          {file && !uploadResult && (
            <Alert>
              <AlertDescription className="text-xs">
                <p className="font-medium mb-1">Required columns:</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  <li>SKU (or Product SKU, Item Code)</li>
                  <li>Warehouse Code (or Warehouse, Location)</li>
                  <li>Quantity (or Qty, Count, Stock)</li>
                  <li>Reason (optional, defaults to &quot;cycle_count&quot;)</li>
                  <li>Notes (optional)</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                {uploadResult.successCount > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {uploadResult.successCount} updated
                    </span>
                  </div>
                )}
                {uploadResult.errorCount > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {uploadResult.errorCount} errors
                    </span>
                  </div>
                )}
              </div>

              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Errors:</p>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {uploadResult.successCount > 0 && uploadResult.errorCount === 0 && (
                <Progress value={100} className="h-2" />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            {uploadResult && uploadResult.errorCount > 0 ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <FileUp className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}