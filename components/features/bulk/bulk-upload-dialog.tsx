'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Download, Info } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileUpload } from '@/components/ui/file-upload'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const formSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.name.endsWith('.csv'), 'File must be a CSV')
    .refine((file) => file.type === 'text/csv' || file.type === '', 
      'File must be a CSV file (text/csv MIME type)')
    .refine((file) => file.size <= 50 * 1024 * 1024, 'File size must be less than 50MB'),
  operationType: z.enum(['import', 'update']),
  entityType: z.enum(['products', 'inventory', 'pricing', 'customers']),
  validateOnly: z.boolean().default(false),
  rollbackOnError: z.boolean().default(true),
})

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: BulkUploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      operationType: 'import',
      entityType: 'products',
      validateOnly: false,
      rollbackOnError: true,
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', values.file)
      formData.append('operationType', values.operationType)
      formData.append('entityType', values.entityType)
      formData.append('validateOnly', values.validateOnly.toString())
      formData.append('rollbackOnError', values.rollbackOnError.toString())

      // Create an AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch('/api/bulk/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const { operationId } = await response.json()

      toast.success('Bulk operation started', {
        description: `Operation ID: ${operationId}`,
      })

      onSuccess()
    } catch (error) {
      // Sanitize error messages
      let errorMessage = 'Failed to start bulk operation'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. Please try again.'
        } else if (error.message.toLowerCase().includes('network')) {
          errorMessage = 'Network error. Please check your connection.'
        } else if (error.message.toLowerCase().includes('unauthorized') || 
                   error.message.toLowerCase().includes('authentication')) {
          errorMessage = 'Authentication error. Please sign in again.'
        } else if (error.message.toLowerCase().includes('validation') || 
                   error.message.toLowerCase().includes('invalid')) {
          // Validation errors are generally safe to show
          errorMessage = error.message
        } else {
          // For other errors, check if it's a user-friendly message
          const safePatterns = [
            'file size',
            'csv',
            'format',
            'required',
            'missing',
            'duplicate',
            'already exists'
          ]
          
          const lowerMessage = error.message.toLowerCase()
          const isSafeMessage = safePatterns.some(pattern => lowerMessage.includes(pattern))
          
          errorMessage = isSafeMessage ? error.message : 'Failed to start bulk operation'
        }
      }
      
      toast.error(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const downloadTemplate = () => {
    const entityType = form.watch('entityType')
    const templates: Record<string, string> = {
      products:
        'sku,name,description,category,price\nPROD-001,Widget A,Description here,Hardware,29.99',
      inventory:
        'sku,warehouse_code,quantity,reason,notes\nPROD-001,WH-001,100,cycle_count,Initial count',
      pricing: 'sku,price_tier,price,min_quantity\nPROD-001,wholesale,24.99,10',
      customers:
        'email,name,company,price_tier\njohn@example.com,John Doe,Acme Corp,wholesale',
    }

    const blob = new Blob([templates[entityType]], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${entityType}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getFieldRequirements = (entityType: string) => {
    const requirements: Record<string, string[]> = {
      products: ['sku', 'name', 'description (optional)', 'category (optional)', 'price (optional)'],
      inventory: ['sku', 'warehouse_code', 'quantity', 'reason (optional)', 'notes (optional)'],
      pricing: ['sku', 'price_tier', 'price', 'min_quantity (optional)'],
      customers: ['email', 'name', 'company (optional)', 'price_tier (optional)'],
    }
    return requirements[entityType] || []
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Operation</DialogTitle>
          <DialogDescription>
            Upload a CSV file to perform bulk operations on your data
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="operationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operation Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="import">Import New</SelectItem>
                        <SelectItem value="update">Update Existing</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="entityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="products">Products</SelectItem>
                        <SelectItem value="inventory">Inventory</SelectItem>
                        <SelectItem value="pricing">Pricing</SelectItem>
                        <SelectItem value="customers">Customers</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="validateOnly"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Validate Only</FormLabel>
                      <FormDescription>
                        Check for errors without making changes
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rollbackOnError"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={form.watch('validateOnly')}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Rollback on Error</FormLabel>
                      <FormDescription>
                        Undo all changes if any record fails
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Need a template? Download one for your data type</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={downloadTemplate}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>CSV File</FormLabel>
                  <FormControl>
                    <FileUpload
                      {...field}
                      accept=".csv"
                      maxSize={50 * 1024 * 1024} // 50MB
                      onChange={(file) => onChange(file)}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum file size: 50MB. Large files will be processed in
                    chunks for optimal performance.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Field Requirements */}
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Required fields for {form.watch('entityType')}:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {getFieldRequirements(form.watch('entityType')).map((field, index) => (
                      <li key={index}>{field}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? 'Processing...' : 'Start Operation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}