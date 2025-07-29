import { escapeCSVField, arrayToCSV, createCSVBlob } from '@/lib/utils/csv'

describe('CSV Utilities', () => {
  describe('escapeCSVField', () => {
    it('should handle null and undefined values', () => {
      expect(escapeCSVField(null)).toBe('""')
      expect(escapeCSVField(undefined)).toBe('""')
    })

    it('should handle basic string values', () => {
      expect(escapeCSVField('hello')).toBe('hello')
      expect(escapeCSVField('world')).toBe('world')
    })

    it('should handle numeric values', () => {
      expect(escapeCSVField(123)).toBe('123')
      expect(escapeCSVField(0)).toBe('0')
      expect(escapeCSVField(-1)).toBe('"-1"') // Negative numbers are escaped
    })

    it('should escape quotes by doubling them', () => {
      expect(escapeCSVField('hello"world')).toBe('"hello""world"')
      expect(escapeCSVField('"quoted"')).toBe('"""quoted"""')
    })

    it('should escape newlines', () => {
      expect(escapeCSVField('hello\nworld')).toBe('"hello\nworld"')
      expect(escapeCSVField('line1\r\nline2')).toBe('"line1\r\nline2"')
    })

    it('should escape carriage returns', () => {
      expect(escapeCSVField('hello\rworld')).toBe('"hello\rworld"')
    })

    it('should escape commas', () => {
      expect(escapeCSVField('hello,world')).toBe('"hello,world"')
    })

    it('should escape fields starting with special characters to prevent CSV injection', () => {
      expect(escapeCSVField('=SUM(A1:A10)')).toBe('"=SUM(A1:A10)"')
      expect(escapeCSVField('+123')).toBe('"+123"')
      expect(escapeCSVField('-456')).toBe('"-456"')
      expect(escapeCSVField('@email')).toBe('"@email"')
      expect(escapeCSVField('\ttabbed')).toBe('"\ttabbed"')
      expect(escapeCSVField('\rreturn')).toBe('"\rreturn"')
    })

    it('should handle complex strings with multiple special characters', () => {
      expect(escapeCSVField('hello"world\nwith,commas')).toBe('"hello""world\nwith,commas"')
    })

    it('should handle empty strings', () => {
      expect(escapeCSVField('')).toBe('')
    })

    it('should handle boolean values', () => {
      expect(escapeCSVField(true)).toBe('true')
      expect(escapeCSVField(false)).toBe('false')
    })
  })

  describe('arrayToCSV', () => {
    it('should convert simple array to CSV', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ]
      const result = arrayToCSV(data)
      expect(result).toBe('name,age\nJohn,30\nJane,25')
    })

    it('should handle empty array', () => {
      const result = arrayToCSV([])
      expect(result).toBe('')
    })

    it('should handle empty array with headers', () => {
      const result = arrayToCSV([], ['name', 'age'])
      expect(result).toBe('name,age')
    })

    it('should use provided headers', () => {
      const data = [
        { name: 'John', age: 30, city: 'NYC' },
        { name: 'Jane', age: 25, city: 'LA' }
      ]
      const headers = ['name', 'city']
      const result = arrayToCSV(data, headers)
      expect(result).toBe('name,city\nJohn,NYC\nJane,LA')
    })

    it('should escape special characters in data', () => {
      const data = [
        { name: 'John "Doe"', age: 30 },
        { name: 'Jane\nSmith', age: 25 }
      ]
      const result = arrayToCSV(data)
      expect(result).toBe('name,age\n"John ""Doe""",30\n"Jane\nSmith",25')
    })

    it('should handle missing properties gracefully', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane' } // missing age
      ]
      const result = arrayToCSV(data)
      expect(result).toBe('name,age\nJohn,30\nJane,""')
    })

    it('should handle nested objects and arrays', () => {
      const data = [
        { name: 'John', details: { city: 'NYC' } },
        { name: 'Jane', details: { city: 'LA' } }
      ]
      const result = arrayToCSV(data)
      expect(result).toBe('name,details\nJohn,[object Object]\nJane,[object Object]')
    })

    it('should handle mixed data types', () => {
      const data = [
        { name: 'John', age: 30, active: true, score: 95.5 },
        { name: 'Jane', age: 25, active: false, score: 88.0 }
      ]
      const result = arrayToCSV(data)
      expect(result).toBe('name,age,active,score\nJohn,30,true,95.5\nJane,25,false,88')
    })
  })

  describe('createCSVBlob', () => {
    it('should create a blob with correct MIME type', () => {
      const csvContent = 'name,age\nJohn,30'
      const blob = createCSVBlob(csvContent)
      
      expect(blob.type).toBe('text/csv;charset=utf-8')
    })

    it('should include UTF-8 BOM for Excel compatibility', () => {
      const csvContent = 'name,age\nJohn,30'
      const blob = createCSVBlob(csvContent)
      
      // Verify blob size includes BOM (3 bytes)
      expect(blob.size).toBe(csvContent.length + 3)
      
      // Verify MIME type
      expect(blob.type).toBe('text/csv;charset=utf-8')
    })

    it('should handle empty CSV content', () => {
      const blob = createCSVBlob('')
      expect(blob.size).toBeGreaterThan(0) // Should contain BOM
    })

    it('should handle large CSV content', () => {
      const largeContent = 'a,b,c\n'.repeat(1000)
      const blob = createCSVBlob(largeContent)
      expect(blob.size).toBe(largeContent.length + 3) // +3 for BOM
    })
  })

  describe('Integration tests', () => {
    it('should handle complete CSV workflow', () => {
      const data = [
        { name: 'John "Doe"', age: 30, city: 'NYC' },
        { name: 'Jane\nSmith', age: 25, city: 'LA' }
      ]
      
      const csvString = arrayToCSV(data)
      const blob = createCSVBlob(csvString)
      
      expect(blob.type).toBe('text/csv;charset=utf-8')
      expect(csvString).toContain('"John ""Doe"""')
      expect(csvString).toContain('"Jane\nSmith"')
    })

    it('should prevent CSV injection attacks', () => {
      const maliciousData = [
        { name: '=SUM(A1:A10)', value: 100 },
        { name: '+123', value: 200 },
        { name: '@email.com', value: 300 }
      ]
      
      const csvString = arrayToCSV(maliciousData)
      
      // All fields should be properly quoted
      expect(csvString).toContain('"=SUM(A1:A10)"')
      expect(csvString).toContain('"+123"')
      expect(csvString).toContain('"@email.com"')
    })
  })
})