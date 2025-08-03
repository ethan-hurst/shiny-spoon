import { z } from 'zod'
import {
  COLUMN_MAPPINGS,
  generateCSV,
  parseCSV,
  parseInventoryCSV,
  validateCSVFile,
  type ParseError,
  type ParseResult,
} from '@/lib/csv/parser'
import type { InventoryImportRow } from '@/types/inventory.types'

describe('CSV Parser', () => {
  describe('parseCSV', () => {
    const testSchema = z.object({
      sku: z.string().min(1),
      quantity: z.number().int().min(0),
      notes: z.string().optional(),
    })

    it('should parse valid CSV data', () => {
      const csvContent = `sku,quantity,notes
SKU001,100,Initial stock
SKU002,50,Restock`

      const result = parseCSV(csvContent, testSchema)

      expect(result.data).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
      expect(result.data[0]).toEqual({
        sku: 'SKU001',
        quantity: 100,
        notes: 'Initial stock',
      })
    })

    it('should handle different header variations', () => {
      const csvContent = `product_sku,qty,comments
SKU001,100,Test note`

      const result = parseCSV(csvContent, testSchema, COLUMN_MAPPINGS)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toEqual({
        sku: 'SKU001',
        quantity: 100,
        notes: 'Test note',
      })
    })

    it('should normalize headers to lowercase with underscores', () => {
      const csvContent = `Product SKU,Quantity On Hand,Additional Notes
SKU001,100,Test`

      const mappings = {
        sku: ['product_sku'],
        quantity: ['quantity_on_hand'],
        notes: ['additional_notes'],
      }

      const result = parseCSV(csvContent, testSchema, mappings)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].sku).toBe('SKU001')
    })

    it('should skip empty rows', () => {
      const csvContent = `sku,quantity
SKU001,100

SKU002,50
,
SKU003,75`

      const result = parseCSV(csvContent, testSchema)

      expect(result.data).toHaveLength(3)
      expect(result.data.map((d) => d.sku)).toEqual([
        'SKU001',
        'SKU002',
        'SKU003',
      ])
    })

    it('should handle quoted values', () => {
      const csvContent = `sku,quantity,notes
"SKU001",100,"Notes with, comma"
"SKU-002",50,"Notes with ""quotes"""
SKU003,75,Simple notes`

      const result = parseCSV(csvContent, testSchema)

      expect(result.data).toHaveLength(3)
      expect(result.data[0].notes).toBe('Notes with, comma')
      expect(result.data[1].notes).toBe('Notes with "quotes"')
    })

    it('should report missing required columns', () => {
      const csvContent = `product_code,stock_level
SKU001,100`

      const result = parseCSV(csvContent, testSchema)

      expect(result.data).toHaveLength(0)
      expect(result.errors).toHaveLength(2) // Missing sku and quantity mappings
      expect(result.errors[0].message).toContain('Missing required column')
    })

    it('should validate data against schema', () => {
      const csvContent = `sku,quantity
,100
SKU002,invalid
SKU003,-5`

      const result = parseCSV(csvContent, testSchema)

      expect(result.data).toHaveLength(0)
      expect(result.errors).toHaveLength(3)

      // Check specific errors
      const errors = result.errors
      expect(errors[0].message).toContain('Required')
      expect(errors[1].message).toContain('must be a valid number')
      expect(errors[2].message).toContain('non-negative')
    })

    it('should add warning for empty valid data', () => {
      const csvContent = `sku,quantity`

      const result = parseCSV(csvContent, testSchema)

      expect(result.data).toHaveLength(0)
      expect(result.warnings).toContain('No valid data found in CSV file')
    })
  })

  describe('security features', () => {
    const testSchema = z.object({
      sku: z.string(),
      quantity: z.number(),
    })

    it('should sanitize formula injection attempts', () => {
      const csvContent = `sku,quantity
=1+1,100
+1+1,50
-1+1,25
@SUM(A1:A10),10
	TAB,5`

      const result = parseCSV(csvContent, testSchema)

      expect(result.data).toHaveLength(5)
      expect(result.data[0].sku).toBe("'=1+1")
      expect(result.data[1].sku).toBe("'+1+1")
      expect(result.data[2].sku).toBe("'-1+1")
      expect(result.data[3].sku).toBe("'@SUM(A1:A10)")
      expect(result.data[4].sku).toBe("'	TAB")
    })

    it('should reject dangerous URL schemes', () => {
      const csvContent = `sku,quantity
javascript:alert('XSS'),100
data:text/html,<script>alert('XSS')</script>,50`

      const result = parseCSV(csvContent, testSchema)

      expect(result.data).toHaveLength(0)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0].message).toContain('dangerous URL schemes')
      expect(result.errors[1].message).toContain('dangerous URL schemes')
    })

    it('should reject excessively long content', () => {
      const longString = 'x'.repeat(10001)
      const csvContent = `sku,quantity
${longString},100`

      const result = parseCSV(csvContent, testSchema)

      expect(result.data).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('exceeds maximum length')
    })
  })

  describe('parseInventoryCSV', () => {
    it('should parse valid inventory CSV', () => {
      const csvContent = `sku,warehouse_code,quantity,reason,notes
SKU001,WH001,100,cycle_count,Regular count
SKU002,WH002,50,adjustment,Damage`

      const result = parseInventoryCSV(csvContent)

      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toEqual({
        sku: 'SKU001',
        warehouse_code: 'WH001',
        quantity: 100,
        reason: 'cycle_count',
        notes: 'Regular count',
      })
    })

    it('should use default reason when not provided', () => {
      const csvContent = `sku,warehouse_code,quantity
SKU001,WH001,100`

      const result = parseInventoryCSV(csvContent)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].reason).toBe('cycle_count')
    })

    it('should handle alternative column names', () => {
      const csvContent = `product_code,location,qty,type,comments
SKU001,WH001,100,adjustment,Test`

      const result = parseInventoryCSV(csvContent)

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        sku: 'SKU001',
        warehouse_code: 'WH001',
        quantity: 100,
        reason: 'adjustment',
        notes: 'Test',
      })
    })
  })

  describe('generateCSV', () => {
    it('should generate CSV from data', () => {
      const data = [
        { sku: 'SKU001', name: 'Product 1', price: 99.99 },
        { sku: 'SKU002', name: 'Product 2', price: 149.99 },
      ]

      const columns = [
        { key: 'sku' as const, header: 'SKU' },
        { key: 'name' as const, header: 'Product Name' },
        { key: 'price' as const, header: 'Price' },
      ]

      const csv = generateCSV(data, columns)

      expect(csv).toBe(
        '"SKU","Product Name","Price"\n' +
          '"SKU001","Product 1","99.99"\n' +
          '"SKU002","Product 2","149.99"'
      )
    })

    it('should handle special characters and quotes', () => {
      const data = [
        { name: 'Product with, comma', desc: 'Has "quotes"' },
        { name: 'Normal product', desc: null },
      ]

      const columns = [
        { key: 'name' as const, header: 'Name' },
        { key: 'desc' as const, header: 'Description' },
      ]

      const csv = generateCSV(data, columns)

      expect(csv).toBe(
        '"Name","Description"\n' +
          '"Product with, comma","Has ""quotes"""\n' +
          '"Normal product",""'
      )
    })

    it('should sanitize formula injection in output', () => {
      const data = [
        { sku: '=1+1', name: '+SUM(A1:A10)' },
        { sku: '-1+1', name: '@command' },
      ]

      const columns = [
        { key: 'sku' as const, header: 'SKU' },
        { key: 'name' as const, header: 'Name' },
      ]

      const csv = generateCSV(data, columns)

      expect(csv).toContain("'=1+1")
      expect(csv).toContain("'+SUM(A1:A10)")
      expect(csv).toContain("'-1+1")
      expect(csv).toContain("'@command")
    })

    it('should return empty string for empty data', () => {
      const csv = generateCSV([], [{ key: 'test', header: 'Test' }])
      expect(csv).toBe('')
    })
  })

  describe('validateCSVFile', () => {
    it('should validate correct CSV file', () => {
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const result = validateCSVFile(file)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject non-CSV extensions', () => {
      const file = new File(['test'], 'test.xlsx', {
        type: 'application/vnd.ms-excel',
      })
      const result = validateCSVFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('.csv extension')
    })

    it('should accept various CSV MIME types', () => {
      const mimeTypes = ['text/csv', 'application/csv', 'text/plain']

      mimeTypes.forEach((type) => {
        const file = new File(['test'], 'test.csv', { type })
        const result = validateCSVFile(file)
        expect(result.valid).toBe(true)
      })
    })

    it('should reject invalid MIME types', () => {
      const file = new File(['test'], 'test.csv', { type: 'application/json' })
      const result = validateCSVFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid file type')
    })

    it('should reject files that are too large', () => {
      const largeContent = 'x'.repeat(6 * 1024 * 1024) // 6MB
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' })
      const result = validateCSVFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('less than 5MB')
    })

    it('should reject empty or very small files', () => {
      const file = new File(['tiny'], 'empty.csv', { type: 'text/csv' })
      const result = validateCSVFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty or corrupted')
    })
  })

  describe('error reporting', () => {
    const testSchema = z.object({
      sku: z.string().min(1),
      quantity: z.number().int().min(0),
    })

    it('should provide detailed error information', () => {
      const csvContent = `sku,quantity
SKU001,invalid
,50
SKU003,-10`

      const result = parseCSV(csvContent, testSchema)

      expect(result.errors).toHaveLength(3)

      // Check error details
      const error1 = result.errors[0]
      expect(error1.row).toBe(2)
      expect(error1.column).toBe('quantity')
      expect(error1.value).toBe('invalid')

      const error2 = result.errors[1]
      expect(error2.row).toBe(3)
      expect(error2.column).toBe('sku')

      const error3 = result.errors[2]
      expect(error3.row).toBe(4)
      expect(error3.message).toContain('non-negative')
    })

    it('should handle Papa Parse errors', () => {
      const invalidCSV = `"unclosed quote
SKU001,100`

      const result = parseCSV(invalidCSV, testSchema)

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toBeDefined()
    })
  })

  describe('type conversion', () => {
    it('should convert quantity strings to numbers', () => {
      const csvContent = `sku,quantity
SKU001,100
SKU002,50.5
SKU003,0`

      const schema = z.object({
        sku: z.string(),
        quantity: z.number(),
      })

      const result = parseCSV(csvContent, schema)

      expect(result.data).toHaveLength(3)
      expect(result.data[0].quantity).toBe(100)
      expect(result.data[1].quantity).toBe(50) // parseInt truncates decimals
      expect(result.data[2].quantity).toBe(0)
      expect(typeof result.data[0].quantity).toBe('number')
    })

    it('should handle invalid number conversions', () => {
      const csvContent = `sku,quantity
SKU001,abc
SKU002,`

      const schema = z.object({
        sku: z.string(),
        quantity: z.number(),
      })

      const result = parseCSV(csvContent, schema)

      expect(result.data).toHaveLength(0)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0].message).toContain('valid number')
    })
  })
})
