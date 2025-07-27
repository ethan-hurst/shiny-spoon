// Isomorphic File check utility
export function isFile(obj: any): obj is File {
  // In Node.js, File might not be defined, so we check for its existence first
  if (typeof File !== 'undefined') {
    return obj instanceof File
  }
  // In Node.js environments without File, check for File-like properties
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    typeof obj.size === 'number' &&
    typeof obj.stream === 'function'
  )
}