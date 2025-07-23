import { z } from 'zod'
import { productSchema } from '@/lib/validations/product'

export interface CSVParseResult {
  success: boolean
  data?: any[]
  errors?: string[]
  totalRows?: number
  validRows?: number
}

export interface ProductImportRow {
  sku: string
  name: string
  description?: string
  category?: string
  base_price: number
  cost?: number
  weight?: number
}

const csvRowSchema = z.object({
  sku: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid SKU format'),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  base_price: z.number().positive(),
  cost: z.number().min(0).optional(),
  weight: z.number().positive().optional(),
})

export function parseProductCSV(csvContent: string): CSVParseResult {
  try {
    const lines = csvContent.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return {
        success: false,
        errors: ['CSV file must have a header row and at least one data row'],
      }
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const requiredHeaders = ['sku', 'name', 'base_price']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
    
    if (missingHeaders.length > 0) {
      return {
        success: false,
        errors: [`Missing required columns: ${missingHeaders.join(', ')}`],
      }
    }

    const errors: string[] = []
    const validRows: ProductImportRow[] = []
    const dataRows = lines.slice(1)

    // Validate row count
    if (dataRows.length > 5000) {
      return {
        success: false,
        errors: ['CSV file contains more than 5000 rows. Please split into smaller files.'],
      }
    }

    // Parse each row
    dataRows.forEach((line, index) => {
      const rowNumber = index + 2 // Account for header row
      
      try {
        const values = parseCSVLine(line)
        const rowData: any = {}

        headers.forEach((header, i) => {
          const value = values[i]?.trim()
          
          if (header === 'base_price' || header === 'cost' || header === 'weight') {
            rowData[header] = value ? parseFloat(value) : undefined
          } else {
            rowData[header] = value || undefined
          }
        })

        // Validate row data
        const result = csvRowSchema.safeParse(rowData)
        
        if (result.success) {
          validRows.push(result.data)
        } else {
          const fieldErrors = result.error.flatten().fieldErrors
          Object.entries(fieldErrors).forEach(([field, messages]) => {
            errors.push(`Row ${rowNumber}, ${field}: ${messages.join(', ')}`)
          })
        }
      } catch (error) {
        errors.push(`Row ${rowNumber}: Failed to parse line`)
      }
    })

    return {
      success: errors.length === 0,
      data: validRows,
      errors: errors.length > 0 ? errors : undefined,
      totalRows: dataRows.length,
      validRows: validRows.length,
    }
  } catch (error) {
    return {
      success: false,
      errors: ['Failed to parse CSV file. Please check the format.'],
    }
  }
}

// Helper function to parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  // Don't forget the last field
  result.push(current)
  
  return result
}

export function generateProductCSVTemplate(): string {
  const headers = ['sku', 'name', 'description', 'category', 'base_price', 'cost', 'weight']
  const sampleRows = [
    ['WIDGET-001', 'Premium Widget', 'High quality widget for industrial use', 'Hardware', '99.99', '45.00', '2.5'],
    ['GADGET-002', 'Super Gadget', 'Amazing gadget with multiple features', 'Electronics', '149.99', '75.00', '1.2'],
    ['TOOL-003', 'Professional Tool', 'Heavy duty tool for professionals', 'Tools', '299.99', '150.00', '5.0'],
  ]

  const csvLines = [
    headers.join(','),
    ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ]

  return csvLines.join('\n')
}

export async function validateProductsForImport(
  products: ProductImportRow[],
  organizationId: string,
  supabase: any
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []
  
  // Check for duplicate SKUs within the import
  const skus = products.map(p => p.sku)
  const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index)
  
  if (duplicateSkus.length > 0) {
    errors.push(`Duplicate SKUs in import: ${[...new Set(duplicateSkus)].join(', ')}`)
  }

  // Check for existing SKUs in database
  const { data: existingProducts } = await supabase
    .from('products')
    .select('sku')
    .eq('organization_id', organizationId)
    .in('sku', skus)

  if (existingProducts && existingProducts.length > 0) {
    const existingSkus = existingProducts.map((p: any) => p.sku)
    errors.push(`SKUs already exist: ${existingSkus.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}