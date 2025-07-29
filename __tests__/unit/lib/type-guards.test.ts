import { isNotNull, isNotUndefined, isDefined, hasProperty } from '@/lib/type-guards'

describe('Type Guards', () => {
  describe('isNotNull', () => {
    it('should return true for non-null values', () => {
      expect(isNotNull('string')).toBe(true)
      expect(isNotNull(0)).toBe(true)
      expect(isNotNull(false)).toBe(true)
      expect(isNotNull({})).toBe(true)
      expect(isNotNull([])).toBe(true)
      expect(isNotNull(undefined)).toBe(true)
    })

    it('should return false for null values', () => {
      expect(isNotNull(null)).toBe(false)
    })

    it('should work with type narrowing', () => {
      const value: string | null = 'test'
      if (isNotNull(value)) {
        // TypeScript should know value is string here
        expect(typeof value).toBe('string')
      }
    })
  })

  describe('isNotUndefined', () => {
    it('should return true for defined values', () => {
      expect(isNotUndefined('string')).toBe(true)
      expect(isNotUndefined(0)).toBe(true)
      expect(isNotUndefined(false)).toBe(true)
      expect(isNotUndefined({})).toBe(true)
      expect(isNotUndefined([])).toBe(true)
      expect(isNotUndefined(null)).toBe(true)
    })

    it('should return false for undefined values', () => {
      expect(isNotUndefined(undefined)).toBe(false)
    })

    it('should work with type narrowing', () => {
      const value: string | undefined = 'test'
      if (isNotUndefined(value)) {
        // TypeScript should know value is string here
        expect(typeof value).toBe('string')
      }
    })
  })

  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined('string')).toBe(true)
      expect(isDefined(0)).toBe(true)
      expect(isDefined(false)).toBe(true)
      expect(isDefined({})).toBe(true)
      expect(isDefined([])).toBe(true)
    })

    it('should return false for null and undefined values', () => {
      expect(isDefined(null)).toBe(false)
      expect(isDefined(undefined)).toBe(false)
    })

    it('should work with type narrowing', () => {
      const value: string | null | undefined = 'test'
      if (isDefined(value)) {
        // TypeScript should know value is string here
        expect(typeof value).toBe('string')
      }
    })

    it('should handle mixed null/undefined scenarios', () => {
      const values = ['test', null, undefined, 0, false, {}]
      const definedValues = values.filter(isDefined)
      expect(definedValues).toEqual(['test', 0, false, {}])
    })
  })

  describe('hasProperty', () => {
    it('should return true for objects with the specified property', () => {
      const obj = { name: 'test', age: 25 }
      expect(hasProperty(obj, 'name')).toBe(true)
      expect(hasProperty(obj, 'age')).toBe(true)
    })

    it('should return false for objects without the specified property', () => {
      const obj = { name: 'test' }
      expect(hasProperty(obj, 'age')).toBe(false)
      expect(hasProperty(obj, 'nonexistent')).toBe(false)
    })

    it('should return false for null and undefined', () => {
      expect(hasProperty(null, 'any')).toBe(false)
      expect(hasProperty(undefined, 'any')).toBe(false)
    })

    it('should return false for primitive values', () => {
      expect(hasProperty('string', 'length')).toBe(false)
      expect(hasProperty(123, 'toString')).toBe(false)
      expect(hasProperty(true, 'valueOf')).toBe(false)
    })

    it('should work with arrays', () => {
      const arr = [1, 2, 3]
      expect(hasProperty(arr, 'length')).toBe(true)
      expect(hasProperty(arr, '0')).toBe(true)
      expect(hasProperty(arr, 'push')).toBe(true)
    })

    it('should work with functions', () => {
      const func = () => {}
      expect(hasProperty(func, 'name')).toBe(true)
      expect(hasProperty(func, 'call')).toBe(true)
    })

    it('should work with type narrowing', () => {
      const value: unknown = { name: 'test' }
      if (hasProperty(value, 'name')) {
        // TypeScript should know value has a 'name' property
        expect(typeof value.name).toBe('string')
      }
    })

    it('should handle edge cases', () => {
      // Empty object
      expect(hasProperty({}, 'any')).toBe(false)
      
      // Object with null/undefined values
      const obj = { prop: null, undef: undefined }
      expect(hasProperty(obj, 'prop')).toBe(true)
      expect(hasProperty(obj, 'undef')).toBe(true)
      
      // Object with empty string key
      const obj2 = { '': 'empty' }
      expect(hasProperty(obj2, '')).toBe(true)
    })
  })
})