import {
  parseProductCSV,
  generateProductCSVTemplate,
  validateProductsForImport,
  CSVParseResult,
  ProductImportRow
} from '@/lib/csv/product-import'
import { escapeCSVField } from '@/lib/utils/csv'
import { z } from 'zod'
import Papa from 'papaparse'

// Mock dependencies
jest.mock('@/lib/utils/csv')
jest.mock('papaparse')
// Don't mock Zod - let it work normally

describe('CSV Product Import', () => {
  let mockEscapeCSVField: jest.MockedFunction<typeof escapeCSVField>
  let mockPapaParse: jest.MockedFunction<typeof Papa.parse>
  let mockSupabase: ReturnType<typeof createMockSupabase>

  const validCSVContent = `sku,name,description,category,base_price,cost,weight
WIDGET-001,Premium Widget,High quality widget,Hardware,99.99,45.00,2.5
GADGET-002,Super Gadget,Amazing gadget,Electronics,149.99,75.00,1.2`

  const mockParseResult = {
    data: [
      {
        sku: 'WIDGET-001',
        name: 'Premium Widget',
        description: 'High quality widget',
        category: 'Hardware',
        base_price: '99.99',
        cost: '45.00',
        weight: '2.5'
      },
      {
        sku: 'GADGET-002',
        name: 'Super Gadget',
        description: 'Amazing gadget',
        category: 'Electronics',
        base_price: '149.99',
        cost: '75.00',
        weight: '1.2'
      }
    ],
    errors: [],
    meta: {
      fields: ['sku', 'name', 'description', 'category', 'base_price', 'cost', 'weight']
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockEscapeCSVField = escapeCSVField as jest.MockedFunction<typeof escapeCSVField>
    mockEscapeCSVField.mockImplementation((value: any) => {
      if (value === null || value === undefined) return '""'
      const strValue = String(value)
      if (strValue.includes('"') || strValue.includes(',') || strValue.includes('\n')) {
        return `"${strValue.replace(/"/g, '""')}"`
      }
      return strValue
    })

    mockPapaParse = Papa.parse as jest.MockedFunction<typeof Papa.parse>
    mockPapaParse.mockImplementation((csvContent: string, options: any) => {
      if (options.complete) {
        options.complete(mockParseResult)
      }
      return mockParseResult
    })

    mockSupabase = createMockSupabase()
  })

  describe('parseProductCSV', () => {
    it('should successfully parse valid CSV content', () => {
      const result = parseProductCSV(validCSVContent)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.totalRows).toBe(2)
      expect(result.validRows).toBe(2)
      expect(result.errors).toBeUndefined()

      expect(result.data![0]).toEqual({
        sku: 'WIDGET-001',
        name: 'Premium Widget',
        description: 'High quality widget',
        category: 'Hardware',
        base_price: 99.99,
        cost: 45.00,
        weight: 2.5
      })
    })

    it('should call Papa.parse with correct options', () => {
      parseProductCSV(validCSVContent)

      expect(mockPapaParse).toHaveBeenCalledWith(validCSVContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: expect.any(Function),
        dynamicTyping: false,
        complete: expect.any(Function)
      })
    })

    it('should transform headers to lowercase and trim spaces', () => {
      const callArgs = mockPapaParse.mock.calls[0]
      const transformHeader = callArgs[1].transformHeader

      expect(transformHeader('  SKU  ')).toBe('sku')
      expect(transformHeader('Base Price')).toBe('base price')
      expect(transformHeader('NAME')).toBe('name')
    })

    it('should handle Papa.parse errors', () => {
      const errorResult = {
        ...mockParseResult,
        errors: [
          { row: 1, message: 'Parse error on line 2' },
          { message: 'General parse error' }
        ]
      }

      mockPapaParse.mockImplementation((csvContent: string, options: any) => {
        if (options.complete) {
          options.complete(errorResult)
        }
        return errorResult
      })

      const result = parseProductCSV(validCSVContent)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Row 3: Parse error on line 2') // row + 2 for header offset
      expect(result.errors).toContain('Row 2: General parse error') // default row 0 + 2
    })

    it('should reject empty CSV content', () => {
      mockPapaParse.mockReturnValue({
        data: [],
        errors: [],
        meta: { fields: [] }
      })

      const result = parseProductCSV('')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('CSV file must have a header row and at least one data row')
    })

    it('should validate required headers', () => {
      const missingHeadersResult = {
        ...mockParseResult,
        meta: { fields: ['sku', 'name'] } // Missing base_price
      }

      mockPapaParse.mockReturnValue(missingHeadersResult)

      const result = parseProductCSV(validCSVContent)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Missing required columns: base_price')
    })

    it('should reject CSV files with more than 5000 rows', () => {
      const largeDataResult = {
        ...mockParseResult,
        data: new Array(5001).fill(mockParseResult.data[0])
      }

      mockPapaParse.mockReturnValue(largeDataResult)

      const result = parseProductCSV(validCSVContent)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('CSV file contains more than 5000 rows. Please split into smaller files.')
    })

    it('should parse numeric fields correctly', () => {
      const result = parseProductCSV(validCSVContent)

      expect(result.data![0].base_price).toBe(99.99)
      expect(result.data![0].cost).toBe(45.00)
      expect(result.data![0].weight).toBe(2.5)
    })

    it('should handle optional fields', () => {
      const dataWithOptionalFields = {
        ...mockParseResult,
        data: [{
          sku: 'BASIC-001',
          name: 'Basic Product',
          base_price: '29.99',
          description: '',
          category: '',
          cost: '',
          weight: ''
        }]
      }

      mockPapaParse.mockReturnValue(dataWithOptionalFields)

      const result = parseProductCSV(validCSVContent)

      expect(result.data![0]).toEqual({
        sku: 'BASIC-001',
        name: 'Basic Product',
        base_price: 29.99,
        description: undefined,
        category: undefined,
        cost: undefined,
        weight: undefined
      })
    })

    it('should validate row data with Zod schema', () => {
      const mockSafeParse = jest.fn()
      const mockSchema = {
        safeParse: mockSafeParse
      }

      // Mock the Zod schema creation chain
      const mockString = jest.fn().mockReturnValue({
        min: jest.fn().mockReturnValue({
          regex: jest.fn().mockReturnValue(mockString)
        }),
        optional: jest.fn().mockReturnValue(mockString)
      })
      const mockNumber = jest.fn().mockReturnValue({
        positive: jest.fn().mockReturnValue({
          optional: jest.fn().mockReturnValue(mockNumber)
        }),
        min: jest.fn().mockReturnValue({
          optional: jest.fn().mockReturnValue(mockNumber)
        })
      })

      ;(z as any).object.mockReturnValue(mockSchema)
      ;(z as any).string.mockReturnValue(mockString)
      ;(z as any).number.mockReturnValue(mockNumber)

      // Mock successful validation
      mockSafeParse.mockReturnValue({
        success: true,
        data: {
          sku: 'WIDGET-001',
          name: 'Premium Widget',
          base_price: 99.99
        }
      })

      const result = parseProductCSV(validCSVContent)

      expect(mockSafeParse).toHaveBeenCalledTimes(2) // Once for each row
      expect(result.success).toBe(true)
    })

    it('should handle Zod validation errors', () => {
      const mockSafeParse = jest.fn()
      const mockSchema = {
        safeParse: mockSafeParse
      }

      ;(z as any).object.mockReturnValue(mockSchema)

      // Mock validation failure
      mockSafeParse.mockReturnValue({
        success: false,
        error: {
          flatten: () => ({
            fieldErrors: {
              sku: ['Invalid SKU format'],
              base_price: ['Price must be positive']
            }
          })
        }
      })

      const result = parseProductCSV(validCSVContent)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Row 2, sku: Invalid SKU format')
      expect(result.errors).toContain('Row 2, base_price: Price must be positive')
    })

    it('should handle row parsing exceptions', () => {
      // Cause an exception during row processing
      mockPapaParse.mockReturnValue({
        data: [{ sku: null }], // This will cause an error when calling toString().trim()
        errors: [],
        meta: { fields: ['sku', 'name', 'base_price'] }
      })

      const result = parseProductCSV(validCSVContent)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Row 2: Failed to parse row')
    })

    it('should handle empty string fields correctly', () => {
      const dataWithEmptyFields = {
        ...mockParseResult,
        data: [{
          sku: 'TEST-001',
          name: 'Test Product',
          description: '',
          category: '  ',
          base_price: '99.99',
          cost: '',
          weight: '0'
        }]
      }

      mockPapaParse.mockReturnValue(dataWithEmptyFields)

      const result = parseProductCSV(validCSVContent)

      expect(result.data![0].description).toBeUndefined()
      expect(result.data![0].category).toBeUndefined()
      expect(result.data![0].cost).toBeUndefined()
      expect(result.data![0].weight).toBe(0)
    })
  })

  describe('generateProductCSVTemplate', () => {
    it('should generate CSV template with headers and sample rows', () => {
      const template = generateProductCSVTemplate()

      expect(mockEscapeCSVField).toHaveBeenCalledWith('sku')
      expect(mockEscapeCSVField).toHaveBeenCalledWith('name')
      expect(mockEscapeCSVField).toHaveBeenCalledWith('WIDGET-001')
      expect(mockEscapeCSVField).toHaveBeenCalledWith('Premium Widget')

      // Should have header row plus 3 sample rows
      const lines = template.split('\n')
      expect(lines).toHaveLength(4)
    })

    it('should include all required and optional columns', () => {
      generateProductCSVTemplate()

      const expectedHeaders = ['sku', 'name', 'description', 'category', 'base_price', 'cost', 'weight']
      expectedHeaders.forEach(header => {
        expect(mockEscapeCSVField).toHaveBeenCalledWith(header)
      })
    })

    it('should include sample product data', () => {
      generateProductCSVTemplate()

      // Check for sample SKUs
      expect(mockEscapeCSVField).toHaveBeenCalledWith('WIDGET-001')
      expect(mockEscapeCSVField).toHaveBeenCalledWith('GADGET-002')
      expect(mockEscapeCSVField).toHaveBeenCalledWith('TOOL-003')

      // Check for sample prices
      expect(mockEscapeCSVField).toHaveBeenCalledWith('99.99')
      expect(mockEscapeCSVField).toHaveBeenCalledWith('149.99')
      expect(mockEscapeCSVField).toHaveBeenCalledWith('299.99')
    })

    it('should properly escape all fields', () => {
      generateProductCSVTemplate()

      // All fields should be escaped
      expect(mockEscapeCSVField).toHaveBeenCalledTimes(28) // 7 headers + 21 sample data fields (7 cols × 3 rows)
    })
  })

  describe('validateProductsForImport', () => {
    const mockProducts: ProductImportRow[] = [
      {
        sku: 'WIDGET-001',
        name: 'Premium Widget',
        description: 'High quality widget',
        category: 'Hardware',
        base_price: 99.99,
        cost: 45.00,
        weight: 2.5
      },
      {
        sku: 'GADGET-002',
        name: 'Super Gadget',
        base_price: 149.99
      }
    ]

    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      } as any)
    })

    it('should return valid when no issues found', async () => {
      const result = await validateProductsForImport(mockProducts, 'org-123', mockSupabase)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect duplicate SKUs within import', async () => {
      const productsWithDuplicates = [
        ...mockProducts,
        {
          sku: 'WIDGET-001', // Duplicate
          name: 'Another Widget',
          base_price: 79.99
        }
      ]

      const result = await validateProductsForImport(productsWithDuplicates, 'org-123', mockSupabase)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate SKUs in import: WIDGET-001')
    })

    it('should detect multiple duplicate SKUs', async () => {
      const productsWithMultipleDuplicates = [
        ...mockProducts,
        {
          sku: 'WIDGET-001', // Duplicate 1
          name: 'Another Widget',
          base_price: 79.99
        },
        {
          sku: 'GADGET-002', // Duplicate 2
          name: 'Another Gadget',
          base_price: 89.99
        }
      ]

      const result = await validateProductsForImport(productsWithMultipleDuplicates, 'org-123', mockSupabase)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate SKUs in import: WIDGET-001, GADGET-002')
    })

    it('should check for existing SKUs in database', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { sku: 'WIDGET-001' }
              ],
              error: null
            })
          })
        })
      } as any)

      const result = await validateProductsForImport(mockProducts, 'org-123', mockSupabase)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('SKUs already exist: WIDGET-001')
    })

    it('should query database with correct parameters', async () => {
      const mockIn = jest.fn().mockResolvedValue({ data: [], error: null })
      const mockEq = jest.fn().mockReturnValue({ in: mockIn })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any)

      await validateProductsForImport(mockProducts, 'org-123', mockSupabase)

      expect(mockSupabase.from).toHaveBeenCalledWith('products')
      expect(mockSelect).toHaveBeenCalledWith('sku')
      expect(mockEq).toHaveBeenCalledWith('organization_id', 'org-123')
      expect(mockIn).toHaveBeenCalledWith('sku', ['WIDGET-001', 'GADGET-002'])
    })

    it('should handle database query errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      } as any)

      // Should not throw, but continue with validation
      const result = await validateProductsForImport(mockProducts, 'org-123', mockSupabase)

      // Since we can't check existing SKUs, validation should still check for internal duplicates
      expect(result.valid).toBe(true) // No internal duplicates
      expect(result.errors).toHaveLength(0)
    })

    it('should handle empty product list', async () => {
      const result = await validateProductsForImport([], 'org-123', mockSupabase)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle null database response', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any)

      const result = await validateProductsForImport(mockProducts, 'org-123', mockSupabase)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should combine duplicate and existing SKU errors', async () => {
      const productsWithDuplicates = [
        ...mockProducts,
        {
          sku: 'WIDGET-001', // Internal duplicate
          name: 'Another Widget',
          base_price: 79.99
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { sku: 'GADGET-002' } // Existing in database
              ],
              error: null
            })
          })
        })
      } as any)

      const result = await validateProductsForImport(productsWithDuplicates, 'org-123', mockSupabase)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors).toContain('Duplicate SKUs in import: WIDGET-001')
      expect(result.errors).toContain('SKUs already exist: GADGET-002')
    })
  })

  // Integration tests
  describe('Integration tests', () => {
    it('should work together for complete CSV import workflow', async () => {
      // Step 1: Parse CSV
      const parseResult = parseProductCSV(validCSVContent)
      expect(parseResult.success).toBe(true)

      // Step 2: Validate for import
      const validationResult = await validateProductsForImport(
        parseResult.data!,
        'org-123',
        mockSupabase
      )
      expect(validationResult.valid).toBe(true)

      // Step 3: Generate template
      const template = generateProductCSVTemplate()
      expect(template).toBeTruthy()
      expect(template.split('\n')).toHaveLength(4) // Header + 3 sample rows
    })

    it('should handle complete workflow with validation errors', async () => {
      // Mock validation failure
      const mockSafeParse = jest.fn().mockReturnValue({
        success: false,
        error: {
          flatten: () => ({
            fieldErrors: {
              sku: ['Invalid SKU format']
            }
          })
        }
      })

      ;(z as any).object.mockReturnValue({ safeParse: mockSafeParse })

      const parseResult = parseProductCSV(validCSVContent)
      expect(parseResult.success).toBe(false)
      expect(parseResult.errors).toContain('Row 2, sku: Invalid SKU format')
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          in: jest.fn()
        })
      })
    })
  }
}