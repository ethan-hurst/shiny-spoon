import { SupabaseClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
import { z } from 'zod'
import { escapeCSVField } from '@/lib/utils/csv'
import { productSchema } from '@/lib/validations/product'
import { Database } from '@/types/database.types'

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
  sku: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid SKU format'),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  base_price: z.number().positive(),
  cost: z.number().min(0).optional(),
  weight: z.number().positive().optional(),
})

export function parseProductCSV(csvContent: string): CSVParseResult {
  const errors: string[] = []
  const validRows: ProductImportRow[] = []

  // Parse CSV using papaparse
  const parseResult = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
    dynamicTyping: false, // We'll handle type conversion ourselves
    complete: (results) => {
      // Check for parse errors
      if (results.errors.length > 0) {
        results.errors.forEach((error) => {
          errors.push(`Row ${(error.row || 0) + 2}: ${error.message}`)
        })
      }
    },
  })

  // Validate parsed data
  const data = parseResult.data as any[]

  if (data.length === 0) {
    return {
      success: false,
      errors: ['CSV file must have a header row and at least one data row'],
    }
  }

  // Check required headers
  const headers = parseResult.meta.fields || []
  const requiredHeaders = ['sku', 'name', 'base_price']
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h))

  if (missingHeaders.length > 0) {
    return {
      success: false,
      errors: [`Missing required columns: ${missingHeaders.join(', ')}`],
    }
  }

  // Validate row count
  if (data.length > 5000) {
    return {
      success: false,
      errors: [
        'CSV file contains more than 5000 rows. Please split into smaller files.',
      ],
    }
  }

  // Parse and validate each row
  data.forEach((row, index) => {
    const rowNumber = index + 2 // Account for header row

    try {
      const rowData: any = {}

      // Process each field
      headers.forEach((header) => {
        const value = row[header]?.toString().trim()

        if (
          header === 'base_price' ||
          header === 'cost' ||
          header === 'weight'
        ) {
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
      errors.push(`Row ${rowNumber}: Failed to parse row`)
    }
  })

  return {
    success: errors.length === 0,
    data: validRows,
    errors: errors.length > 0 ? errors : undefined,
    totalRows: data.length,
    validRows: validRows.length,
  }
}

/**
 * Generates a CSV template string for product imports with headers and sample rows.
 *
 * The template includes properly escaped fields and example data for each required and optional column.
 * @returns A CSV-formatted string containing headers and three sample product rows.
 */
export function generateProductCSVTemplate(): string {
  const headers = [
    'sku',
    'name',
    'description',
    'category',
    'base_price',
    'cost',
    'weight',
  ]
  const sampleRows = [
    [
      'WIDGET-001',
      'Premium Widget',
      'High quality widget for industrial use',
      'Hardware',
      '99.99',
      '45.00',
      '2.5',
    ],
    [
      'GADGET-002',
      'Super Gadget',
      'Amazing gadget with multiple features',
      'Electronics',
      '149.99',
      '75.00',
      '1.2',
    ],
    [
      'TOOL-003',
      'Professional Tool',
      'Heavy duty tool for professionals',
      'Tools',
      '299.99',
      '150.00',
      '5.0',
    ],
  ]

  const csvLines = [
    headers.map(escapeCSVField).join(','),
    ...sampleRows.map((row) =>
      row.map((cell) => escapeCSVField(cell)).join(',')
    ),
  ]

  return csvLines.join('\n')
}

export async function validateProductsForImport(
  products: ProductImportRow[],
  organizationId: string,
  supabase: SupabaseClient<Database>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  // Check for duplicate SKUs within the import
  const skus = products.map((p) => p.sku)
  const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index)

  if (duplicateSkus.length > 0) {
    errors.push(
      `Duplicate SKUs in import: ${[...new Set(duplicateSkus)].join(', ')}`
    )
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
