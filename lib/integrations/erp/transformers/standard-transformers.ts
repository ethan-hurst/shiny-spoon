import { ERPType } from '../types'

/**
 * Standard transformation functions for common data conversions
 */
export const standardTransformers = {
  // Date transformations
  /**
   * Convert SAP date format (YYYYMMDD) to ISO date
   */
  sapDateToISO: (sapDate: string): string => {
    if (!sapDate || sapDate.length !== 8) return ''
    return `${sapDate.slice(0, 4)}-${sapDate.slice(4, 6)}-${sapDate.slice(6, 8)}`
  },

  /**
   * Convert ISO date to SAP format (YYYYMMDD)
   */
  isoToSapDate: (isoDate: string): string => {
    if (!isoDate) return ''
    const date = new Date(isoDate)
    if (isNaN(date.getTime())) return ''
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
  },

  /**
   * Convert Unix timestamp to ISO date
   */
  unixToISO: (timestamp: number): string => {
    if (!timestamp) return ''
    return new Date(timestamp * 1000).toISOString()
  },

  /**
   * Convert ISO date to Unix timestamp
   */
  isoToUnix: (isoDate: string): number => {
    if (!isoDate) return 0
    return Math.floor(new Date(isoDate).getTime() / 1000)
  },

  // Unit conversions
  /**
   * Convert between units of measure
   */
  convertUnit: (value: number, from: string, to: string): number => {
    if (!value || !from || !to) return value
    if (from === to) return value
    
    const conversions: Record<string, number> = {
      // Quantity conversions
      'EA:DZ': 12,      // Each to Dozen
      'DZ:EA': 1/12,    // Dozen to Each
      'EA:CS': 24,      // Each to Case
      'CS:EA': 1/24,    // Case to Each
      
      // Weight conversions
      'KG:LB': 2.20462, // Kilogram to Pound
      'LB:KG': 0.453592, // Pound to Kilogram
      'KG:G': 1000,     // Kilogram to Gram
      'G:KG': 0.001,    // Gram to Kilogram
      
      // Length conversions
      'M:FT': 3.28084,  // Meter to Feet
      'FT:M': 0.3048,   // Feet to Meter
      'CM:IN': 0.393701, // Centimeter to Inch
      'IN:CM': 2.54,    // Inch to Centimeter
      
      // Volume conversions
      'L:GAL': 0.264172, // Liter to Gallon (US)
      'GAL:L': 3.78541,  // Gallon (US) to Liter
    }
    
    const key = `${from.toUpperCase()}:${to.toUpperCase()}`
    const factor = conversions[key]
    
    return factor ? value * factor : value
  },

  // Status mappings
  /**
   * Map ERP-specific status codes to unified status
   */
  mapStatus: (erpStatus: string | number, erpType: ERPType): string => {
    const statusMaps: Record<ERPType, Record<string | number, string>> = {
      SAP: {
        '': 'active',
        'X': 'inactive',
        'D': 'deleted',
        '01': 'active',
        '02': 'inactive',
        '03': 'blocked',
      },
      NETSUITE: {
        'F': 'active',
        'T': 'inactive',
        'false': 'active',
        'true': 'inactive',
      },
      DYNAMICS365: {
        0: 'active',
        1: 'inactive',
        2: 'deleted',
        'Active': 'active',
        'Inactive': 'inactive',
      },
      ORACLE_CLOUD: {
        'A': 'active',
        'I': 'inactive',
        'D': 'deleted',
      },
      INFOR: {
        '10': 'active',
        '90': 'inactive',
        '99': 'deleted',
      },
      EPICOR: {
        'true': 'active',
        'false': 'inactive',
      },
      SAGE: {
        '0': 'active',
        '1': 'inactive',
        '2': 'blocked',
      },
    }
    
    const map = statusMaps[erpType]
    return map?.[erpStatus] || 'unknown'
  },

  /**
   * Map unified status to ERP-specific codes
   */
  mapStatusToERP: (status: string, erpType: ERPType): string | number => {
    const reverseMaps: Record<ERPType, Record<string, string | number>> = {
      SAP: {
        'active': '',
        'inactive': 'X',
        'deleted': 'D',
        'blocked': '03',
      },
      NETSUITE: {
        'active': 'F',
        'inactive': 'T',
        'deleted': 'T',
      },
      DYNAMICS365: {
        'active': 0,
        'inactive': 1,
        'deleted': 2,
      },
      ORACLE_CLOUD: {
        'active': 'A',
        'inactive': 'I',
        'deleted': 'D',
      },
      INFOR: {
        'active': '10',
        'inactive': '90',
        'deleted': '99',
      },
      EPICOR: {
        'active': 'true',
        'inactive': 'false',
        'deleted': 'false',
      },
      SAGE: {
        'active': '0',
        'inactive': '1',
        'blocked': '2',
        'deleted': '1',
      },
    }
    
    const map = reverseMaps[erpType]
    return map?.[status] ?? status
  },

  // String transformations
  /**
   * Convert to uppercase
   */
  uppercase: (value: string): string => {
    return value ? String(value).toUpperCase() : ''
  },

  /**
   * Convert to lowercase
   */
  lowercase: (value: string): string => {
    return value ? String(value).toLowerCase() : ''
  },

  /**
   * Trim whitespace
   */
  trim: (value: string): string => {
    return value ? String(value).trim() : ''
  },

  /**
   * Remove special characters
   */
  removeSpecialChars: (value: string): string => {
    return value ? String(value).replace(/[^a-zA-Z0-9\s]/g, '') : ''
  },

  /**
   * Pad string to fixed length
   */
  padLeft: (value: string, length: number, char: string = '0'): string => {
    if (!value) return char.repeat(length)
    return String(value).padStart(length, char)
  },

  /**
   * Truncate string to max length
   */
  truncate: (value: string, maxLength: number): string => {
    if (!value) return ''
    const str = String(value)
    return str.length > maxLength ? str.slice(0, maxLength) : str
  },

  // Number transformations
  /**
   * Round to decimal places
   */
  round: (value: number, decimals: number = 2): number => {
    if (typeof value !== 'number') return 0
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
  },

  /**
   * Convert percentage to decimal
   */
  percentToDecimal: (value: number): number => {
    return typeof value === 'number' ? value / 100 : 0
  },

  /**
   * Convert decimal to percentage
   */
  decimalToPercent: (value: number): number => {
    return typeof value === 'number' ? value * 100 : 0
  },

  /**
   * Parse currency string to number
   */
  parseCurrency: (value: string): number => {
    if (!value) return 0
    const cleaned = String(value).replace(/[^0-9.-]/g, '')
    return parseFloat(cleaned) || 0
  },

  /**
   * Format number as currency
   */
  formatCurrency: (value: number, currency: string = 'USD'): string => {
    if (typeof value !== 'number') return '0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value)
  },

  // Boolean transformations
  /**
   * Convert various boolean representations to boolean
   */
  toBoolean: (value: any): boolean => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      return ['true', 'yes', 'y', '1', 'x', 'active'].includes(lower)
    }
    if (typeof value === 'number') return value > 0
    return false
  },

  /**
   * Convert boolean to Y/N
   */
  booleanToYN: (value: boolean): string => {
    return value ? 'Y' : 'N'
  },

  /**
   * Convert boolean to X/blank (SAP style)
   */
  booleanToX: (value: boolean): string => {
    return value ? 'X' : ''
  },

  // Array transformations
  /**
   * Join array into string
   */
  arrayToString: (value: any[], separator: string = ','): string => {
    return Array.isArray(value) ? value.join(separator) : ''
  },

  /**
   * Split string into array
   */
  stringToArray: (value: string, separator: string = ','): string[] => {
    return value ? String(value).split(separator).map(s => s.trim()) : []
  },

  // Address transformations
  /**
   * Format address lines
   */
  formatAddress: (address: any): string => {
    const parts = [
      address.street1,
      address.street2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter(Boolean)
    
    return parts.join(', ')
  },

  /**
   * Parse address string
   */
  parseAddress: (addressString: string): any => {
    const parts = addressString.split(',').map(s => s.trim())
    return {
      street1: parts[0] || '',
      street2: parts[1] || '',
      city: parts[2] || '',
      state: parts[3] || '',
      postalCode: parts[4] || '',
      country: parts[5] || '',
    }
  },

  // Phone transformations
  /**
   * Format phone number
   */
  formatPhone: (phone: string): string => {
    if (!phone) return ''
    const cleaned = phone.replace(/\D/g, '')
    
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    
    return phone
  },

  /**
   * Clean phone number
   */
  cleanPhone: (phone: string): string => {
    return phone ? phone.replace(/\D/g, '') : ''
  },

  // Null handling
  /**
   * Convert null/undefined to empty string
   */
  nullToEmpty: (value: any): string => {
    return value ?? ''
  },

  /**
   * Convert empty string to null
   */
  emptyToNull: (value: string): string | null => {
    return value === '' ? null : value
  },

  /**
   * Default value if null/undefined
   */
  defaultValue: <T>(value: T | null | undefined, defaultVal: T): T => {
    return value ?? defaultVal
  },
}

// Export type for transformer functions
export type TransformerFunction = (value: any, ...args: any[]) => any

// Create a registry of named transformers
export class TransformerRegistry {
  private transformers = new Map<string, TransformerFunction>()

  constructor() {
    // Register standard transformers
    Object.entries(standardTransformers).forEach(([name, fn]) => {
      this.register(name, fn)
    })
  }

  register(name: string, transformer: TransformerFunction): void {
    this.transformers.set(name, transformer)
  }

  get(name: string): TransformerFunction | undefined {
    return this.transformers.get(name)
  }

  has(name: string): boolean {
    return this.transformers.has(name)
  }

  list(): string[] {
    return Array.from(this.transformers.keys())
  }
}

export const transformerRegistry = new TransformerRegistry()