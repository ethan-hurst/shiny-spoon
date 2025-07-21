'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileUp, FileDown, Download, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { importPricingRules, exportPricingRules } from '@/app/actions/pricing'

interface ImportExportProps {
  variant?: 'outline' | 'default'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function PricingImportExport({ variant = 'outline', size = 'sm' }: ImportExportProps) {
  const [open, setOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResults, setImportResults] = useState<{
    successes: string[]
    errors: string[]
  } | null>(null)
  
  const router = useRouter()

  async function handleImport() {
    if (!importFile) {
      toast.error('Please select a file to import')
      return
    }

    setImporting(true)
    setImportResults(null)
    
    try {
      const results = await importPricingRules(importFile)
      setImportResults(results)
      
      if (results.errors.length === 0) {
        toast.success(`Successfully imported ${results.successes.length} pricing rules`)
        router.refresh()
        setTimeout(() => {
          setOpen(false)
          setImportFile(null)
          setImportResults(null)
        }, 2000)
      } else {
        toast.warning(`Imported ${results.successes.length} rules with ${results.errors.length} errors`)
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import pricing rules')
    } finally {
      setImporting(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    
    try {
      const csvContent = await exportPricingRules()
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pricing-rules-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success('Pricing rules exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export pricing rules')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <FileUp className="h-4 w-4 mr-2" />
          Import/Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import/Export Pricing Rules</DialogTitle>
          <DialogDescription>
            Import pricing rules from a CSV file or export existing rules
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="import" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="import-file">Select CSV File</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setImportFile(file)
                    // Clear previous import results when new file is selected
                    if (file) {
                      setImportResults(null)
                    }
                  }}
                  disabled={importing}
                />
              </div>

              <Alert>
                <AlertDescription>
                  <strong>CSV Format Requirements:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Headers: name, description, rule_type, priority, discount_type, discount_value, is_active, start_date, end_date</li>
                    <li>rule_type: tier, quantity, promotion, or override</li>
                    <li>discount_type: percentage, fixed, or price</li>
                    <li>is_active: true or false</li>
                    <li>Dates in YYYY-MM-DD format</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {importResults && (
                <div className="space-y-4">
                  {importResults.successes.length > 0 && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <h4 className="font-medium text-green-900 mb-2">
                        <CheckCircle className="inline h-4 w-4 mr-2" />
                        Successfully Imported ({importResults.successes.length})
                      </h4>
                      <ScrollArea className="h-[100px]">
                        <ul className="text-sm text-green-800 space-y-1">
                          {importResults.successes.map((msg, i) => (
                            <li key={i}>{msg}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}

                  {importResults.errors.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <h4 className="font-medium text-red-900 mb-2">
                        <XCircle className="inline h-4 w-4 mr-2" />
                        Import Errors ({importResults.errors.length})
                      </h4>
                      <ScrollArea className="h-[100px]">
                        <ul className="text-sm text-red-800 space-y-1">
                          {importResults.errors.map((msg, i) => (
                            <li key={i}>{msg}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Rules
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Export all pricing rules to a CSV file. The exported file can be:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Used as a backup of your pricing configuration</li>
                    <li>Modified in a spreadsheet application</li>
                    <li>Imported back into the system</li>
                    <li>Shared with team members for review</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border p-6 text-center">
                <FileDown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Click the button below to download all pricing rules as a CSV file
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Rules
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}