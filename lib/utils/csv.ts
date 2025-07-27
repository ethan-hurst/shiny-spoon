/**
 * CSV utility functions for consistent CSV handling across the application
 */

/**
 * Escapes a CSV field value according to RFC 4180 standards
 * @param value - The value to escape
 * @returns The properly escaped CSV field value
 */
export function escapeCSVField(value: any): string {
  if (value === null || value === undefined) {
    return '""'
  }
  
  const strValue = String(value)
  
  // Check if value needs escaping (contains quotes, newlines, carriage returns, or commas)
  if (
    strValue.includes('"') || 
    strValue.includes('\n') || 
    strValue.includes('\r') || 
    strValue.includes(',')
  ) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${strValue.replace(/"/g, '""')}"`
  }
  
  // Also wrap in quotes if it starts with special characters that could be interpreted as formulas
  // This prevents CSV injection attacks
  if (/^[=+\-@\t\r]/.test(strValue)) {
    return `"${strValue}"`
  }
  
  return strValue
}

/**
 * Converts an array of objects to CSV format
 * @param data - Array of objects to convert
 * @param headers - Optional custom headers (if not provided, uses object keys)
 * @returns CSV string
 */
export function arrayToCSV<T extends Record<string, any>>(
  data: T[],
  headers?: string[]
): string {
  if (data.length === 0) {
    return headers ? headers.map(escapeCSVField).join(',') : ''
  }
  
  const csvHeaders = headers || Object.keys(data[0])
  const headerRow = csvHeaders.map(escapeCSVField).join(',')
  
  const dataRows = data.map(row => 
    csvHeaders.map(header => escapeCSVField(row[header])).join(',')
  )
  
  return [headerRow, ...dataRows].join('\n')
}

/**
 * Generates a CSV download blob
 * @param csvContent - The CSV content as a string
 * @param filename - The filename for the download
 * @returns Blob object for download
 */
export function createCSVBlob(csvContent: string, filename: string): Blob {
  // Add BOM for Excel compatibility with UTF-8
  const BOM = '\uFEFF'
  return new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
}