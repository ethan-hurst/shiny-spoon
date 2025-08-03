/**
 * Determines whether the given object is a File instance or a File-like object across different JavaScript environments.
 *
 * In environments where the global `File` constructor is unavailable (such as Node.js), this function checks for the presence of typical File properties including `name`, `size`, `type`, `lastModified`, and `stream`.
 *
 * @param obj - The object to test for File-like characteristics
 * @returns `true` if the object is a File or File-like; otherwise, `false`
 */
export function isFile(obj: any): obj is File {
  // In Node.js, File might not be defined, so we check for its existence first
  if (typeof File !== 'undefined') {
    return obj instanceof File
  }
  // In Node.js environments without File, check for File-like properties
  // Enhanced validation includes lastModified and type for better security
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    typeof obj.size === 'number' &&
    typeof obj.type === 'string' &&
    typeof obj.lastModified === 'number' &&
    typeof obj.stream === 'function'
  )
}
