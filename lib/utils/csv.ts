/**
 * CSV utility functions for consistent CSV handling across the application
 */

/**
 * Escapes a value for safe inclusion as a CSV field according to RFC 4180, handling special characters and preventing CSV injection.
 *
 * Converts the input to a string, returns an empty quoted string for `null` or `undefined`, doubles internal quotes, and wraps fields in quotes if they contain quotes, newlines, carriage returns, commas, or begin with characters that could trigger CSV injection.
 *
 * @param value - The value to escape for CSV output
 * @returns The escaped CSV field as a string
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
 * Converts an array of objects into a CSV-formatted string.
 *
 * If headers are provided, they determine the column order; otherwise, the keys of the first object are used as headers. All fields are escaped for CSV compatibility.
 *
 * @param data - The array of objects to convert to CSV
 * @param headers - Optional array of header names to use as columns
 * @returns The resulting CSV string
 */
export function arrayToCSV<T extends Record<string, any>>(
  data: T[],
  headers?: string[]
): string {
  if (data.length === 0) {
    return headers ? headers.map(escapeCSVField).join(',') : ''
  }
  
  const csvHeaders = headers || (data[0] ? Object.keys(data[0]) : [])
  const headerRow = csvHeaders.map(escapeCSVField).join(',')
  
  const dataRows = data.map(row => 
    csvHeaders.map(header => escapeCSVField(row[header])).join(',')
  )
  
  return [headerRow, ...dataRows].join('\n')
}

/**
 * Creates a Blob containing CSV data with a UTF-8 BOM for Excel compatibility.
 *
 * Prepends a UTF-8 Byte Order Mark (BOM) to the CSV content to ensure correct encoding in spreadsheet applications.
 *
 * @param csvContent - The CSV content as a string
 * @returns A Blob object containing the CSV data with BOM and the appropriate MIME type
 */
export function createCSVBlob(csvContent: string): Blob {
  // Add BOM for Excel compatibility with UTF-8
  const BOM = '\uFEFF'
  return new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
}