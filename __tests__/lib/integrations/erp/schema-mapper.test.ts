import { SchemaMapper } from '@/lib/integrations/erp/transformers/schema-mapper'
import { ERPType, FieldMapping } from '@/lib/integrations/erp/types'

describe('SchemaMapper', () => {
  let mapper: SchemaMapper

  beforeEach(() => {
    mapper = new SchemaMapper()
  })

  afterEach(() => {
    mapper.clear()
  })

  describe('defineMapping', () => {
    it('should define a mapping between source and target schemas', () => {
      const mappings: FieldMapping[] = [
        { source: 'MATERIAL', target: 'sku', required: true },
        { source: 'MAKTX', target: 'name', required: true },
        { source: 'MEINS', target: 'unit' },
      ]

      mapper.defineMapping({
        source: 'SAP',
        target: 'unified',
        entity: 'products',
        mappings,
      })

      expect(mapper.hasMapping('SAP', 'unified', 'products')).toBe(true)
    })

    it('should create reverse mappings for unified target', () => {
      const mappings: FieldMapping[] = [
        { source: 'MATERIAL', target: 'sku' },
      ]

      mapper.defineMapping({
        source: 'SAP',
        target: 'unified',
        entity: 'products',
        mappings,
      })

      expect(mapper.hasMapping('unified', 'SAP', 'products')).toBe(true)
    })
  })

  describe('transform', () => {
    beforeEach(() => {
      const mappings: FieldMapping[] = [
        { source: 'MATERIAL', target: 'sku', required: true },
        { source: 'MAKTX', target: 'name', required: true },
        { source: 'MEINS', target: 'unit' },
        { source: 'NETPR', target: 'price', transform: (v) => parseFloat(v) },
      ]

      mapper.defineMapping({
        source: 'SAP',
        target: 'unified',
        entity: 'products',
        mappings,
      })
    })

    it('should transform data according to mappings', () => {
      const sapData = {
        MATERIAL: '000123',
        MAKTX: 'Test Product',
        MEINS: 'EA',
        NETPR: '99.99',
      }

      const result = mapper.transform<any>('SAP', 'unified', 'products', sapData)

      expect(result).toEqual({
        sku: '000123',
        name: 'Test Product',
        unit: 'EA',
        price: 99.99,
      })
    })

    it('should throw error for required fields that are missing', () => {
      const sapData = {
        MATERIAL: '000123',
        // Missing MAKTX (name) which is required
        MEINS: 'EA',
      }

      expect(() => {
        mapper.transform('SAP', 'unified', 'products', sapData)
      }).toThrow('Required field name is missing')
    })

    it('should apply default values when specified', () => {
      const mappings: FieldMapping[] = [
        { source: 'id', target: 'id' },
        { source: 'status', target: 'status', default: 'active' },
      ]

      mapper.defineMapping({
        source: 'NETSUITE',
        target: 'unified',
        entity: 'customers',
        mappings,
      })

      const data = { id: '123' }
      const result = mapper.transform<any>('NETSUITE', 'unified', 'customers', data)

      expect(result.status).toBe('active')
    })

    it('should handle nested field paths', () => {
      const mappings: FieldMapping[] = [
        { source: 'customer.details.name', target: 'name' },
        { source: 'customer.details.email', target: 'email' },
      ]

      mapper.defineMapping({
        source: 'DYNAMICS365',
        target: 'unified',
        entity: 'customers',
        mappings,
      })

      const data = {
        customer: {
          details: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      }

      const result = mapper.transform<any>('DYNAMICS365', 'unified', 'customers', data)

      expect(result).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      })
    })

    it('should handle array notation in paths', () => {
      const mappings: FieldMapping[] = [
        { source: 'items[0].price', target: 'firstItemPrice' },
      ]

      mapper.defineMapping({
        source: 'ORACLE_CLOUD',
        target: 'unified',
        entity: 'orders',
        mappings,
      })

      const data = {
        items: [
          { price: 10.99 },
          { price: 20.99 },
        ],
      }

      const result = mapper.transform<any>('ORACLE_CLOUD', 'unified', 'orders', data)

      expect(result.firstItemPrice).toBe(10.99)
    })
  })

  describe('transformArray', () => {
    it('should transform an array of items', () => {
      const mappings: FieldMapping[] = [
        { source: 'id', target: 'id' },
        { source: 'name', target: 'name' },
      ]

      mapper.defineMapping({
        source: 'SAGE',
        target: 'unified',
        entity: 'products',
        mappings,
      })

      const data = [
        { id: '1', name: 'Product 1' },
        { id: '2', name: 'Product 2' },
      ]

      const result = mapper.transformArray<any>('SAGE', 'unified', 'products', data)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: '1', name: 'Product 1' })
      expect(result[1]).toEqual({ id: '2', name: 'Product 2' })
    })
  })

  describe('validate', () => {
    beforeEach(() => {
      const mappings: FieldMapping[] = [
        { source: 'id', target: 'id', required: true },
        { source: 'name', target: 'name', required: true },
        { source: 'description', target: 'description', required: false },
      ]

      mapper.defineMapping({
        source: 'INFOR',
        target: 'unified',
        entity: 'products',
        mappings,
      })
    })

    it('should validate data against mapping requirements', () => {
      const validData = {
        id: '123',
        name: 'Test Product',
        description: 'Optional description',
      }

      const result = mapper.validate('INFOR', 'unified', 'products', validData)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return errors for missing required fields', () => {
      const invalidData = {
        id: '123',
        // Missing required 'name' field
        description: 'Optional description',
      }

      const result = mapper.validate('INFOR', 'unified', 'products', invalidData)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Required field name is missing')
    })

    it('should pass validation when optional fields are missing', () => {
      const data = {
        id: '123',
        name: 'Test Product',
        // Missing optional 'description' field
      }

      const result = mapper.validate('INFOR', 'unified', 'products', data)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('getAllMappings', () => {
    it('should return all defined mappings', () => {
      mapper.defineMapping({
        source: 'SAP',
        target: 'unified',
        entity: 'products',
        mappings: [{ source: 'MATERIAL', target: 'sku' }],
      })

      mapper.defineMapping({
        source: 'NETSUITE',
        target: 'unified',
        entity: 'customers',
        mappings: [{ source: 'id', target: 'id' }],
      })

      const allMappings = mapper.getAllMappings()

      expect(allMappings).toHaveLength(2)
      expect(allMappings.some(m => m.source === 'SAP' && m.entity === 'products')).toBe(true)
      expect(allMappings.some(m => m.source === 'NETSUITE' && m.entity === 'customers')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle null and undefined values', () => {
      const mappings: FieldMapping[] = [
        { source: 'nullField', target: 'nullField' },
        { source: 'undefinedField', target: 'undefinedField' },
      ]

      mapper.defineMapping({
        source: 'EPICOR',
        target: 'unified',
        entity: 'test',
        mappings,
      })

      const data = {
        nullField: null,
        undefinedField: undefined,
      }

      const result = mapper.transform<any>('EPICOR', 'unified', 'test', data)

      expect(result).toEqual({})
    })

    it('should handle function defaults', () => {
      const mappings: FieldMapping[] = [
        { 
          source: 'timestamp', 
          target: 'createdAt', 
          default: () => new Date().toISOString() 
        },
      ]

      mapper.defineMapping({
        source: 'SAP',
        target: 'unified',
        entity: 'logs',
        mappings,
      })

      const data = {}
      const result = mapper.transform<any>('SAP', 'unified', 'logs', data)

      expect(result.createdAt).toBeDefined()
      expect(typeof result.createdAt).toBe('string')
    })
  })
})