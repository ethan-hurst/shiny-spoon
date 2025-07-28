/**
 * Handlebars helper functions for code generation
 */

import * as Handlebars from 'handlebars'

// Register all helpers
export function registerHelpers() {
  // Equality comparison
  Handlebars.registerHelper('eq', function (a, b) {
    return a === b
  })

  // Inequality comparison
  Handlebars.registerHelper('neq', function (a, b) {
    return a !== b
  })

  // Unless helper (opposite of if)
  Handlebars.registerHelper('unless', function (conditional, options) {
    if (!conditional) {
      return options.fn(this)
    }
    return options.inverse(this)
  })

  // If helper for complex conditions
  Handlebars.registerHelper('if', function (conditional, options) {
    if (conditional) {
      return options.fn(this)
    }
    return options.inverse(this)
  })

  // Capitalize first letter
  Handlebars.registerHelper('capitalize', function (str) {
    if (!str || typeof str !== 'string') return ''
    return str.charAt(0).toUpperCase() + str.slice(1)
  })

  // Lowercase
  Handlebars.registerHelper('lowercase', function (str) {
    if (!str || typeof str !== 'string') return ''
    return str.toLowerCase()
  })

  // Uppercase
  Handlebars.registerHelper('uppercase', function (str) {
    if (!str || typeof str !== 'string') return ''
    return str.toUpperCase()
  })

  // JSON stringify
  Handlebars.registerHelper('json', function (obj) {
    return JSON.stringify(obj, null, 2)
  })

  // Array contains
  Handlebars.registerHelper('contains', function (array, value) {
    return Array.isArray(array) && array.includes(value)
  })

  // String replace
  Handlebars.registerHelper('replace', function (str, search, replace) {
    if (!str || typeof str !== 'string') return ''
    return str.replace(new RegExp(search, 'g'), replace)
  })

  // Add prefix if value exists
  Handlebars.registerHelper('prefix', function (value, prefix) {
    return value ? prefix + value : ''
  })

  // Add suffix if value exists
  Handlebars.registerHelper('suffix', function (value, suffix) {
    return value ? value + suffix : ''
  })
}
