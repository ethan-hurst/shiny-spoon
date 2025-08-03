import { standardTransformers } from '@/lib/integrations/erp/transformers/standard-transformers'

describe('standardTransformers', () => {
  describe('date transformations', () => {
    it('should convert SAP date to ISO format', () => {
      expect(standardTransformers.sapDateToISO('20240115')).toBe('2024-01-15')
      expect(standardTransformers.sapDateToISO('19991231')).toBe('1999-12-31')
      expect(standardTransformers.sapDateToISO('')).toBe('')
      expect(standardTransformers.sapDateToISO('2024')).toBe('')
    })

    it('should convert ISO date to SAP format', () => {
      expect(standardTransformers.isoToSapDate('2024-01-15')).toBe('20240115')
      expect(standardTransformers.isoToSapDate('2024-01-15T10:30:00Z')).toBe('20240115')
      expect(standardTransformers.isoToSapDate('')).toBe('')
      expect(standardTransformers.isoToSapDate('invalid')).toBe('')
    })

    it('should convert Unix timestamp to ISO date', () => {
      const timestamp = 1705320000 // 2024-01-15 12:00:00 UTC
      const result = standardTransformers.unixToISO(timestamp)
      expect(result).toContain('2024-01-15')
      expect(standardTransformers.unixToISO(0)).toBe('1970-01-01T00:00:00.000Z')
      expect(standardTransformers.unixToISO(null as any)).toBe('')
    })

    it('should convert ISO date to Unix timestamp', () => {
      const result = standardTransformers.isoToUnix('2024-01-15T12:00:00Z')
      expect(result).toBe(1705320000)
      expect(standardTransformers.isoToUnix('')).toBe(0)
      expect(standardTransformers.isoToUnix('invalid')).toBe(NaN)
    })
  })

  describe('unit conversions', () => {
    it('should convert between units of measure', () => {
      // Quantity conversions
      expect(standardTransformers.convertUnit(1, 'EA', 'DZ')).toBe(12)
      expect(standardTransformers.convertUnit(12, 'DZ', 'EA')).toBe(1)
      expect(standardTransformers.convertUnit(1, 'EA', 'CS')).toBe(24)
      expect(standardTransformers.convertUnit(24, 'CS', 'EA')).toBe(1)

      // Weight conversions
      expect(standardTransformers.convertUnit(1, 'KG', 'LB')).toBeCloseTo(2.20462)
      expect(standardTransformers.convertUnit(2.20462, 'LB', 'KG')).toBeCloseTo(1)
      expect(standardTransformers.convertUnit(1, 'KG', 'G')).toBe(1000)
      expect(standardTransformers.convertUnit(1000, 'G', 'KG')).toBe(1)

      // Length conversions
      expect(standardTransformers.convertUnit(1, 'M', 'FT')).toBeCloseTo(3.28084)
      expect(standardTransformers.convertUnit(3.28084, 'FT', 'M')).toBeCloseTo(1)
      expect(standardTransformers.convertUnit(2.54, 'IN', 'CM')).toBe(2.54)
      expect(standardTransformers.convertUnit(1, 'CM', 'IN')).toBeCloseTo(0.393701)

      // Volume conversions
      expect(standardTransformers.convertUnit(1, 'L', 'GAL')).toBeCloseTo(0.264172)
      expect(standardTransformers.convertUnit(1, 'GAL', 'L')).toBeCloseTo(3.78541)
    })

    it('should handle edge cases in unit conversion', () => {
      expect(standardTransformers.convertUnit(0, 'KG', 'LB')).toBe(0)
      expect(standardTransformers.convertUnit(10, 'EA', 'EA')).toBe(10)
      expect(standardTransformers.convertUnit(5, 'UNKNOWN', 'OTHER')).toBe(5)
      expect(standardTransformers.convertUnit(null as any, 'KG', 'LB')).toBe(null)
    })
  })

  describe('status mappings', () => {
    it('should map ERP status to unified status', () => {
      // SAP
      expect(standardTransformers.mapStatus('', 'SAP')).toBe('active')
      expect(standardTransformers.mapStatus('X', 'SAP')).toBe('inactive')
      expect(standardTransformers.mapStatus('D', 'SAP')).toBe('deleted')
      expect(standardTransformers.mapStatus('01', 'SAP')).toBe('active')
      expect(standardTransformers.mapStatus('02', 'SAP')).toBe('inactive')
      expect(standardTransformers.mapStatus('03', 'SAP')).toBe('blocked')

      // NetSuite
      expect(standardTransformers.mapStatus('F', 'NETSUITE')).toBe('active')
      expect(standardTransformers.mapStatus('T', 'NETSUITE')).toBe('inactive')
      expect(standardTransformers.mapStatus('false', 'NETSUITE')).toBe('active')
      expect(standardTransformers.mapStatus('true', 'NETSUITE')).toBe('inactive')

      // Dynamics 365
      expect(standardTransformers.mapStatus(0, 'DYNAMICS365')).toBe('active')
      expect(standardTransformers.mapStatus(1, 'DYNAMICS365')).toBe('inactive')
      expect(standardTransformers.mapStatus(2, 'DYNAMICS365')).toBe('deleted')
      expect(standardTransformers.mapStatus('Active', 'DYNAMICS365')).toBe('active')
      expect(standardTransformers.mapStatus('Inactive', 'DYNAMICS365')).toBe('inactive')

      // Unknown
      expect(standardTransformers.mapStatus('UNKNOWN', 'SAP')).toBe('unknown')
    })

    it('should map unified status to ERP-specific codes', () => {
      // SAP
      expect(standardTransformers.mapStatusToERP('active', 'SAP')).toBe('')
      expect(standardTransformers.mapStatusToERP('inactive', 'SAP')).toBe('X')
      expect(standardTransformers.mapStatusToERP('deleted', 'SAP')).toBe('D')
      expect(standardTransformers.mapStatusToERP('blocked', 'SAP')).toBe('03')

      // NetSuite
      expect(standardTransformers.mapStatusToERP('active', 'NETSUITE')).toBe('F')
      expect(standardTransformers.mapStatusToERP('inactive', 'NETSUITE')).toBe('T')
      expect(standardTransformers.mapStatusToERP('deleted', 'NETSUITE')).toBe('T')

      // Dynamics 365
      expect(standardTransformers.mapStatusToERP('active', 'DYNAMICS365')).toBe(0)
      expect(standardTransformers.mapStatusToERP('inactive', 'DYNAMICS365')).toBe(1)
      expect(standardTransformers.mapStatusToERP('deleted', 'DYNAMICS365')).toBe(2)

      // Unknown status
      expect(standardTransformers.mapStatusToERP('unknown', 'SAP')).toBe('unknown')
    })
  })

  describe('string transformations', () => {
    it('should convert to uppercase', () => {
      expect(standardTransformers.uppercase('hello')).toBe('HELLO')
      expect(standardTransformers.uppercase('Hello World')).toBe('HELLO WORLD')
      expect(standardTransformers.uppercase('')).toBe('')
      expect(standardTransformers.uppercase(null as any)).toBe('')
    })

    it('should convert to lowercase', () => {
      expect(standardTransformers.lowercase('HELLO')).toBe('hello')
      expect(standardTransformers.lowercase('Hello World')).toBe('hello world')
      expect(standardTransformers.lowercase('')).toBe('')
      expect(standardTransformers.lowercase(null as any)).toBe('')
    })

    it('should trim whitespace', () => {
      expect(standardTransformers.trim('  hello  ')).toBe('hello')
      expect(standardTransformers.trim('\n\ttest\n\t')).toBe('test')
      expect(standardTransformers.trim('')).toBe('')
      expect(standardTransformers.trim(null as any)).toBe('')
    })

    it('should remove special characters', () => {
      expect(standardTransformers.removeSpecialChars('hello@world!')).toBe('helloworld')
      expect(standardTransformers.removeSpecialChars('test#123$')).toBe('test123')
      expect(standardTransformers.removeSpecialChars('a-b_c')).toBe('abc')
      expect(standardTransformers.removeSpecialChars('')).toBe('')
    })

    it('should pad string to fixed length', () => {
      expect(standardTransformers.padLeft('123', 6, '0')).toBe('000123')
      expect(standardTransformers.padLeft('hello', 10, ' ')).toBe('     hello')
      expect(standardTransformers.padLeft('', 3, 'X')).toBe('XXX')
      expect(standardTransformers.padLeft('toolong', 5, '0')).toBe('toolong')
    })

    it('should truncate string to max length', () => {
      expect(standardTransformers.truncate('hello world', 5)).toBe('hello')
      expect(standardTransformers.truncate('test', 10)).toBe('test')
      expect(standardTransformers.truncate('', 5)).toBe('')
      expect(standardTransformers.truncate(null as any, 5)).toBe('')
    })
  })

  describe('number transformations', () => {
    it('should round to decimal places', () => {
      expect(standardTransformers.round(3.14159, 2)).toBe(3.14)
      expect(standardTransformers.round(10.5555, 3)).toBe(10.556)
      expect(standardTransformers.round(100, 2)).toBe(100)
      expect(standardTransformers.round('not a number' as any, 2)).toBe(0)
    })

    it('should convert percentage to decimal', () => {
      expect(standardTransformers.percentToDecimal(50)).toBe(0.5)
      expect(standardTransformers.percentToDecimal(100)).toBe(1)
      expect(standardTransformers.percentToDecimal(0)).toBe(0)
      expect(standardTransformers.percentToDecimal('50' as any)).toBe(0)
    })

    it('should convert decimal to percentage', () => {
      expect(standardTransformers.decimalToPercent(0.5)).toBe(50)
      expect(standardTransformers.decimalToPercent(1)).toBe(100)
      expect(standardTransformers.decimalToPercent(0)).toBe(0)
      expect(standardTransformers.decimalToPercent('0.5' as any)).toBe(0)
    })

    it('should parse currency string to number', () => {
      expect(standardTransformers.parseCurrency('$100.00')).toBe(100)
      expect(standardTransformers.parseCurrency('€1,234.56')).toBe(1234.56)
      expect(standardTransformers.parseCurrency('£-99.99')).toBe(-99.99)
      expect(standardTransformers.parseCurrency('')).toBe(0)
      expect(standardTransformers.parseCurrency('invalid')).toBe(NaN)
    })

    it('should format number as currency', () => {
      expect(standardTransformers.formatCurrency(100, 'USD')).toContain('100')
      expect(standardTransformers.formatCurrency(1234.56, 'EUR')).toContain('1,234.56')
      expect(standardTransformers.formatCurrency(0, 'GBP')).toContain('0')
      expect(standardTransformers.formatCurrency('not a number' as any, 'USD')).toBe('0.00')
    })
  })

  describe('boolean transformations', () => {
    it('should convert various representations to boolean', () => {
      expect(standardTransformers.toBoolean(true)).toBe(true)
      expect(standardTransformers.toBoolean(false)).toBe(false)
      expect(standardTransformers.toBoolean('true')).toBe(true)
      expect(standardTransformers.toBoolean('TRUE')).toBe(true)
      expect(standardTransformers.toBoolean('yes')).toBe(true)
      expect(standardTransformers.toBoolean('Y')).toBe(true)
      expect(standardTransformers.toBoolean('1')).toBe(true)
      expect(standardTransformers.toBoolean('X')).toBe(true)
      expect(standardTransformers.toBoolean('active')).toBe(true)
      expect(standardTransformers.toBoolean('false')).toBe(false)
      expect(standardTransformers.toBoolean('no')).toBe(false)
      expect(standardTransformers.toBoolean('0')).toBe(false)
      expect(standardTransformers.toBoolean(1)).toBe(true)
      expect(standardTransformers.toBoolean(0)).toBe(false)
      expect(standardTransformers.toBoolean(-1)).toBe(true)
    })

    it('should convert boolean to Y/N', () => {
      expect(standardTransformers.booleanToYN(true)).toBe('Y')
      expect(standardTransformers.booleanToYN(false)).toBe('N')
    })

    it('should convert boolean to X/blank', () => {
      expect(standardTransformers.booleanToX(true)).toBe('X')
      expect(standardTransformers.booleanToX(false)).toBe('')
    })
  })

  describe('array transformations', () => {
    it('should join array into string', () => {
      expect(standardTransformers.arrayToString(['a', 'b', 'c'])).toBe('a,b,c')
      expect(standardTransformers.arrayToString(['one', 'two'], ' | ')).toBe('one | two')
      expect(standardTransformers.arrayToString([])).toBe('')
      expect(standardTransformers.arrayToString(null as any)).toBe('')
    })

    it('should split string into array', () => {
      expect(standardTransformers.stringToArray('a,b,c')).toEqual(['a', 'b', 'c'])
      expect(standardTransformers.stringToArray('one | two', ' | ')).toEqual(['one', 'two'])
      expect(standardTransformers.stringToArray('  a , b , c  ')).toEqual(['a', 'b', 'c'])
      expect(standardTransformers.stringToArray('')).toEqual([])
    })
  })

  describe('address transformations', () => {
    it('should format address lines', () => {
      const address = {
        street1: '123 Main St',
        street2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      }
      expect(standardTransformers.formatAddress(address))
        .toBe('123 Main St, Apt 4B, New York, NY, 10001, USA')

      const partial = {
        street1: '456 Oak Ave',
        city: 'Boston',
        state: 'MA',
      }
      expect(standardTransformers.formatAddress(partial))
        .toBe('456 Oak Ave, Boston, MA')
    })

    it('should parse address string', () => {
      const result = standardTransformers.parseAddress('123 Main St, Apt 4B, New York, NY, 10001, USA')
      expect(result).toEqual({
        street1: '123 Main St',
        street2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      })

      const partial = standardTransformers.parseAddress('456 Oak Ave, Boston, MA')
      expect(partial.street1).toBe('456 Oak Ave')
      expect(partial.city).toBe('Boston')
      expect(partial.state).toBe('MA')
      expect(partial.postalCode).toBe('')
    })
  })

  describe('phone transformations', () => {
    it('should format phone number', () => {
      expect(standardTransformers.formatPhone('1234567890')).toBe('(123) 456-7890')
      expect(standardTransformers.formatPhone('+1-123-456-7890')).toBe('(123) 456-7890')
      expect(standardTransformers.formatPhone('123')).toBe('123')
      expect(standardTransformers.formatPhone('')).toBe('')
    })

    it('should clean phone number', () => {
      expect(standardTransformers.cleanPhone('(123) 456-7890')).toBe('1234567890')
      expect(standardTransformers.cleanPhone('+1-123-456-7890')).toBe('11234567890')
      expect(standardTransformers.cleanPhone('123abc456')).toBe('123456')
      expect(standardTransformers.cleanPhone('')).toBe('')
    })
  })

  describe('null handling', () => {
    it('should convert null/undefined to empty string', () => {
      expect(standardTransformers.nullToEmpty(null)).toBe('')
      expect(standardTransformers.nullToEmpty(undefined)).toBe('')
      expect(standardTransformers.nullToEmpty('')).toBe('')
      expect(standardTransformers.nullToEmpty('value')).toBe('value')
      expect(standardTransformers.nullToEmpty(0)).toBe(0)
    })

    it('should convert empty string to null', () => {
      expect(standardTransformers.emptyToNull('')).toBe(null)
      expect(standardTransformers.emptyToNull('value')).toBe('value')
      expect(standardTransformers.emptyToNull('   ')).toBe('   ')
    })

    it('should provide default value if null/undefined', () => {
      expect(standardTransformers.defaultValue(null, 'default')).toBe('default')
      expect(standardTransformers.defaultValue(undefined, 'default')).toBe('default')
      expect(standardTransformers.defaultValue('value', 'default')).toBe('value')
      expect(standardTransformers.defaultValue(0, 10)).toBe(0)
      expect(standardTransformers.defaultValue(false, true)).toBe(false)
    })
  })
})