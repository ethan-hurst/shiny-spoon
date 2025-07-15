import Papa from 'papaparse'
import { z } from 'zod'
import type { InventoryImportRow } from '@/types/inventory.types'

// CSV parsing configuration
export const CSV_PARSE_CONFIG: Papa.ParseConfig = {
  header: true,
  skipEmptyLines: true,
  transformHeader: (header: string) => {
    // Normalize headers to lowercase with underscores
    return header.trim().toLowerCase().replace(/\s+/g, '_')
  },
  dynamicTyping: false, // We'll handle type conversion manually for better control
  delimiter: ',',
  quoteChar: '"',
  escapeChar: '"',
  comments: '#',
}

// Dangerous formula injection prefixes
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

// Sanitize cell content to prevent CSV formula injection
function sanitizeCSVContent(content: string): string {
  if (typeof content !== 'string') return String(content)
  
  const trimmed = content.trim()
  
  // Check for formula injection attempts
  if (FORMULA_PREFIXES.some(prefix => trimmed.startsWith(prefix))) {
    // Prepend single quote to neutralize formula
    return `'${trimmed}`
  }
  
  return trimmed
}

// Validate cell content for security risks
function validateCellContent(content: string, fieldName: string): { valid: boolean; error?: string } {
  if (typeof content !== 'string') return { valid: true }
  
  const trimmed = content.trim()
  
  // Check for suspicious patterns
  if (trimmed.includes('javascript:') || trimmed.includes('data:')) {
    return { 
      valid: false, 
      error: `Field '${fieldName}' contains potentially dangerous URL schemes` 
    }
  }
  
  // Check for excessive length
  if (trimmed.length > 10000) {
    return { 
      valid: false, 
      error: `Field '${fieldName}' exceeds maximum length of 10,000 characters` 
    }
  }
  
  return { valid: true }
}

// Column mappings for flexibility in CSV headers
export const COLUMN_MAPPINGS: Record<string, string[]> = {
  sku: ['sku', 'product_sku', 'item_sku', 'product_code', 'item_code'],
  warehouse_code: ['warehouse_code', 'warehouse', 'location', 'warehouse_id', 'location_code'],
  quantity: ['quantity', 'qty', 'count', 'stock', 'on_hand'],
  reason: ['reason', 'adjustment_reason', 'type'],
  notes: ['notes', 'comments', 'description', 'memo'],
}

// Error types for better error handling
export interface ParseError {
  row: number
  column?: string
  message: string
  value?: any
}

export interface ParseResult<T> {
  data: T[]
  errors: ParseError[]
  warnings: string[]
}

// Generic CSV parser with validation
export function parseCSV<T>(
  csvContent: string,
  schema: z.ZodSchema<T>,
  columnMappings: Record<string, string[]> = COLUMN_MAPPINGS
): ParseResult<T> {
  const errors: ParseError[] = []
  const warnings: string[] = []
  const validData: T[] = []

  // Parse CSV
  const parseResult = Papa.parse(csvContent, CSV_PARSE_CONFIG)

  if (parseResult.errors.length > 0) {
    parseResult.errors.forEach((error) => {
      errors.push({
        row: error.row || 0,
        message: error.message,
      })
    })
  }

  // Process each row
  parseResult.data.forEach((row: any, index: number) => {
    const rowNumber = index + 2 // +2 because index is 0-based and we skip header

    // Skip empty rows
    if (Object.keys(row).length === 0) return

    // Map columns based on mappings
    const mappedRow: any = {}
    for (const [targetColumn, possibleHeaders] of Object.entries(columnMappings)) {
      let found = false
      for (const header of possibleHeaders) {
        if (row.hasOwnProperty(header)) {
          // Sanitize content to prevent formula injection
          const rawValue = row[header]
          const sanitizedValue = sanitizeCSVContent(rawValue)
          
          // Validate content for security risks
          const validation = validateCellContent(sanitizedValue, targetColumn)
          if (!validation.valid) {
            errors.push({
              row: rowNumber,
              column: targetColumn,
              message: validation.error!,
              value: rawValue,
            })
            return
          }
          
          mappedRow[targetColumn] = sanitizedValue
          found = true
          break
        }
      }
      if (!found && targetColumn !== 'notes' && targetColumn !== 'reason') {
        // notes and reason are optional
        errors.push({
          row: rowNumber,
          column: targetColumn,
          message: `Missing required column: ${targetColumn}`,
        })
      }
    }

    // Convert quantity to number
    if (mappedRow.quantity !== undefined) {
      const qty = parseInt(mappedRow.quantity)
      if (isNaN(qty)) {
        errors.push({
          row: rowNumber,
          column: 'quantity',
          message: 'Quantity must be a valid number',
          value: mappedRow.quantity,
        })
        return
      }
      mappedRow.quantity = qty
    }

    // Validate with schema
    try {
      const validated = schema.parse(mappedRow)
      validData.push(validated)
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          errors.push({
            row: rowNumber,
            column: err.path.join('.'),
            message: err.message,
            value: mappedRow[err.path[0]],
          })
        })
      }
    }
  })

  // Add warnings
  if (validData.length === 0 && errors.length === 0) {
    warnings.push('No valid data found in CSV file')
  }

  return { data: validData, errors, warnings }
}

// Specific parser for inventory imports
export function parseInventoryCSV(csvContent: string): ParseResult<InventoryImportRow> {
  const inventorySchema = z.object({
    sku: z.string().min(1, 'SKU is required'),
    warehouse_code: z.string().min(1, 'Warehouse code is required'),
    quantity: z.number().int().min(0, 'Quantity must be non-negative'),
    reason: z.string().optional().default('cycle_count'),
    notes: z.string().optional(),
  })

  return parseCSV(csvContent, inventorySchema, COLUMN_MAPPINGS)
}

// CSV generation utilities
export function generateCSV<T extends Record<string, any>>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) return ''

  // Generate headers
  const headers = columns.map(col => `"${col.header}"`).join(',')

  // Generate rows
  const rows = data.map(item => {
    return columns
      .map(col => {
        const value = item[col.key]
        if (value === null || value === undefined) return '""'
        
        // Sanitize content and escape quotes
        const sanitized = sanitizeCSVContent(String(value))
        const escaped = sanitized.replace(/"/g, '""')
        return `"${escaped}"`
      })
      .join(',')
  })

  return [headers, ...rows].join('\n')
}

// Validate CSV file before parsing
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  // Check file extension
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { valid: false, error: 'File must have a .csv extension' }
  }

  // Check MIME type (be more strict)
  const validMimeTypes = [
    'text/csv',
    'application/csv',
    'text/plain', // Some browsers report CSV as text/plain
  ]
  
  if (!validMimeTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `Invalid file type: ${file.type}. Only CSV files are allowed.` 
    }
  }

  // Check file size (5MB limit for security)
  const maxSize = 5 * 1024 * 1024 // 5MB (reduced from 10MB)
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 5MB' }
  }

  // Check minimum file size (prevent empty/suspicious files)
  if (file.size < 10) {
    return { valid: false, error: 'File appears to be empty or corrupted' }
  }

  return { valid: true }
}

// Stream large CSV files (for future enhancement)
export async function* streamParseCSV<T>(
  file: File,
  schema: z.ZodSchema<T>,
  chunkSize: number = 1000
): AsyncGenerator<ParseResult<T>> {
  // This is a placeholder for future implementation
  // Would use Papa.parse with step callback for streaming
  // For now, just parse the entire file
  const content = await file.text()
  yield parseCSV(content, schema)
}