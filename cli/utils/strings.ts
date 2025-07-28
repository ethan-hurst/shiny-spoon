/**
 * String Manipulation Utilities
 * Helper functions for naming conventions
 */

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .split(/(?=[A-Z])|[-_\s]+/)
    .map(word => word.toLowerCase())
    .filter(word => word.length > 0)
    .join('-')
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .split(/(?=[A-Z])|[-\s]+/)
    .map(word => word.toLowerCase())
    .filter(word => word.length > 0)
    .join('_')
}

/**
 * Convert string to CONSTANT_CASE
 */
export function toConstantCase(str: string): string {
  return toSnakeCase(str).toUpperCase()
}

/**
 * Pluralize a word (simple version)
 */
export function pluralize(str: string): string {
  if (str.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].includes(str.slice(-2))) {
    return str.slice(0, -1) + 'ies'
  }
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('z') ||
      str.endsWith('ch') || str.endsWith('sh')) {
    return str + 'es'
  }
  return str + 's'
}

/**
 * Get various naming conventions for a string
 */
export function getNames(str: string) {
  return {
    original: str,
    pascal: toPascalCase(str),
    camel: toCamelCase(str),
    kebab: toKebabCase(str),
    snake: toSnakeCase(str),
    constant: toConstantCase(str),
    plural: pluralize(str),
    pluralPascal: toPascalCase(pluralize(str)),
    pluralCamel: toCamelCase(pluralize(str))
  }
}