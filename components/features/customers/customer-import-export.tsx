'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Upload, Download, FileText, AlertCircle } from 'lucide-react'
import { importCustomers, exportCustomers, validateCustomerImport } from '@/app/actions/customer-import-export'
import { z } from 'zod'
import { customerImportSchema } from '@/lib/customers/validations'

interface CustomerImportExportProps {
  organizationId: string
  tierMap?: Map<string, string> // tier name to tier id mapping
}

// CSV Template
const CSV_TEMPLATE = `company_name,display_name,tax_id,website,tier_name,status,customer_type,billing_line1,billing_line2,billing_city,billing_state,billing_postal_code,billing_country,shipping_line1,shipping_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country,credit_limit,payment_terms,currency,notes,tags,contact_first_name,contact_last_name,contact_email,contact_phone,contact_mobile
"Acme Corporation","Acme Corp","12-3456789","https://acme.com","Gold","active","vip","123 Main St","Suite 100","New York","NY","10001","US","123 Main St","Suite 100","New York","NY","10001","US",50000,30,"USD","Important customer","wholesale,premium","John","Doe","john@acme.com","+1-555-123-4567","+1-555-987-6543"`

export function CustomerImportExport({ organizationId, tierMap }: CustomerImportExportProps) {
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [importData, setImportData] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const handleExport = async () => {
    setIsProcessing(true)
    try {
      const result = await exportCustomers(organizationId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      if (!result.data) {
        toast.error('No data to export')
        return
      }

      // Create and download CSV file
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(`Exported ${result.count} customers`)
      setIsExportOpen(false)
    } catch (error) {
      toast.error('Failed to export customers')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleValidate = async () => {
    if (!importData.trim()) {
      setValidationErrors(['Please paste CSV data to validate'])
      return
    }

    setIsProcessing(true)
    setValidationErrors([])
    
    try {
      const result = await validateCustomerImport(importData)
      
      if (result.errors && result.errors.length > 0) {
        setValidationErrors(result.errors)
      } else if (result.validCount === 0) {
        setValidationErrors(['No valid customer records found'])
      } else {
        toast.success(`Validated ${result.validCount} customers successfully`)
      }
    } catch (error) {
      setValidationErrors(['Failed to validate import data'])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImport = async () => {
    if (!importData.trim()) {
      toast.error('Please paste CSV data to import')
      return
    }

    if (validationErrors.length > 0) {
      toast.error('Please fix validation errors before importing')
      return
    }

    setIsProcessing(true)
    setProgress(0)
    
    try {
      const result = await importCustomers(organizationId, importData, (current, total) => {
        setProgress(Math.round((current / total) * 100))
      })
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(`Successfully imported ${result.imported} customers`)
      
      if (result.skipped > 0) {
        toast.warning(`Skipped ${result.skipped} duplicate customers`)
      }
      
      if (result.errors && result.errors.length > 0) {
        setValidationErrors(result.errors)
      } else {
        setIsImportOpen(false)
        setImportData('')
        // Refresh the page to show new customers
        window.location.reload()
      }
    } catch (error) {
      toast.error('Failed to import customers')
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'customer_import_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setIsImportOpen(true)}
        >
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsExportOpen(true)}
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Import Customers</DialogTitle>
            <DialogDescription>
              Import customers from a CSV file. Download the template for the correct format.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex justify-between items-center">
              <Label>CSV Format Template</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
              >
                <FileText className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-data">Paste CSV Data</Label>
              <Textarea
                id="import-data"
                placeholder="Paste your CSV data here..."
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Validation Errors:</p>
                    <ul className="list-disc list-inside text-sm">
                      {validationErrors.slice(0, 5).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                    {validationErrors.length > 5 && (
                      <p className="text-sm">...and {validationErrors.length - 5} more errors</p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {isProcessing && progress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Importing customers...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={isProcessing || !importData.trim()}
            >
              Validate
            </Button>
            <Button
              onClick={handleImport}
              disabled={isProcessing || !importData.trim() || validationErrors.length > 0}
            >
              {isProcessing ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Customers</DialogTitle>
            <DialogDescription>
              Export all customers to a CSV file. This includes customer information, addresses, and primary contact details.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The export will include all active and inactive customers in your organization. 
                Customer passwords and internal notes are excluded for security.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsExportOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isProcessing}
            >
              {isProcessing ? 'Exporting...' : 'Export All Customers'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}