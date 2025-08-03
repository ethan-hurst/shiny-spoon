import { ERPType, FieldMapping } from '../types'

export interface MappingDefinition {
  source: ERPType
  target: 'unified' | ERPType
  entity: string
  mappings: FieldMapping[]
}

export class SchemaMapper {
  private mappings: Map<string, FieldMapping[]> = new Map()
  private reverseMappings: Map<string, FieldMapping[]> = new Map()

  /**
   * Define a mapping between source and target schemas
   */
  defineMapping(definition: MappingDefinition): void {
    const key = this.getMappingKey(definition.source, definition.target, definition.entity)
    this.mappings.set(key, definition.mappings)
    
    // Create reverse mapping for bidirectional transformation
    if (definition.target === 'unified') {
      const reverseKey = this.getMappingKey('unified' as ERPType, definition.source, definition.entity)
      const reverseMappings = this.createReverseMappings(definition.mappings)
      this.reverseMappings.set(reverseKey, reverseMappings)
    }
  }

  /**
   * Transform data from source to target schema
   */
  transform<T = any>(
    source: ERPType | 'unified',
    target: ERPType | 'unified',
    entity: string,
    data: any
  ): T {
    const key = this.getMappingKey(source, target, entity)
    let mapping = this.mappings.get(key)
    
    // Try reverse mapping if direct mapping not found
    if (!mapping && source === 'unified') {
      mapping = this.reverseMappings.get(key)
    }
    
    if (!mapping) {
      throw new Error(`No mapping found for ${source} -> ${target} (${entity})`)
    }
    
    return this.applyMapping(data, mapping) as T
  }

  /**
   * Transform array of data
   */
  transformArray<T = any>(
    source: ERPType | 'unified',
    target: ERPType | 'unified',
    entity: string,
    data: any[]
  ): T[] {
    return data.map(item => this.transform<T>(source, target, entity, item))
  }

  /**
   * Apply mapping to data
   */
  private applyMapping(data: any, mappings: FieldMapping[]): any {
    const result: any = {}
    
    for (const mapping of mappings) {
      try {
        // Get source value
        const sourceValue = this.getNestedValue(data, mapping.source)
        
        // Apply transformation if defined
        let targetValue = sourceValue
        if (mapping.transform && sourceValue !== undefined) {
          targetValue = mapping.transform(sourceValue)
        }
        
        // Handle required fields
        if (mapping.required && targetValue === undefined) {
          throw new Error(`Required field ${mapping.target} is missing`)
        }
        
        // Apply default value if needed
        if (targetValue === undefined && mapping.default !== undefined) {
          targetValue = typeof mapping.default === 'function' 
            ? mapping.default() 
            : mapping.default
        }
        
        // Set target value
        if (targetValue !== undefined) {
          this.setNestedValue(result, mapping.target, targetValue)
        }
      } catch (error) {
        console.error(`Error mapping field ${mapping.source} -> ${mapping.target}:`, error)
        if (mapping.required) throw error
      }
    }
    
    return result
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    if (!path) return obj
    
    const parts = path.split('.')
    let current = obj
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }
      
      // Handle array notation
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
      if (arrayMatch) {
        const [, key, index] = arrayMatch
        current = current[key]?.[parseInt(index)]
      } else {
        current = current[part]
      }
    }
    
    return current
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.')
    let current = obj
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      
      // Handle array notation
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
      if (arrayMatch) {
        const [, key, index] = arrayMatch
        if (!current[key]) current[key] = []
        if (!current[key][parseInt(index)]) current[key][parseInt(index)] = {}
        current = current[key][parseInt(index)]
      } else {
        if (!current[part]) current[part] = {}
        current = current[part]
      }
    }
    
    current[parts[parts.length - 1]] = value
  }

  /**
   * Create reverse mappings
   */
  private createReverseMappings(mappings: FieldMapping[]): FieldMapping[] {
    return mappings.map(mapping => ({
      source: mapping.target,
      target: mapping.source,
      transform: mapping.transform ? this.createReverseTransform(mapping.transform) : undefined,
      required: false, // Reverse mappings are typically not required
      default: undefined,
    }))
  }

  /**
   * Create reverse transform function (basic implementation)
   */
  private createReverseTransform(transform: Function): Function | undefined {
    // This is a simplified approach - in practice, you'd want to register
    // reverse transforms explicitly for complex transformations
    return undefined
  }

  /**
   * Get mapping key
   */
  private getMappingKey(
    source: ERPType | 'unified',
    target: ERPType | 'unified',
    entity: string
  ): string {
    return `${source}:${target}:${entity}`
  }

  /**
   * Check if mapping exists
   */
  hasMapping(
    source: ERPType | 'unified',
    target: ERPType | 'unified',
    entity: string
  ): boolean {
    const key = this.getMappingKey(source, target, entity)
    return this.mappings.has(key) || this.reverseMappings.has(key)
  }

  /**
   * Get all defined mappings
   */
  getAllMappings(): MappingDefinition[] {
    const definitions: MappingDefinition[] = []
    
    for (const [key, mappings] of this.mappings.entries()) {
      const [source, target, entity] = key.split(':')
      definitions.push({
        source: source as ERPType,
        target: target as 'unified' | ERPType,
        entity,
        mappings,
      })
    }
    
    return definitions
  }

  /**
   * Validate data against mapping requirements
   */
  validate(
    source: ERPType | 'unified',
    target: ERPType | 'unified',
    entity: string,
    data: any
  ): { valid: boolean; errors: string[] } {
    const key = this.getMappingKey(source, target, entity)
    const mapping = this.mappings.get(key) || this.reverseMappings.get(key)
    
    if (!mapping) {
      return { valid: false, errors: [`No mapping found for ${source} -> ${target} (${entity})`] }
    }
    
    const errors: string[] = []
    
    for (const fieldMapping of mapping) {
      if (fieldMapping.required) {
        const value = this.getNestedValue(data, fieldMapping.source)
        if (value === undefined || value === null) {
          errors.push(`Required field ${fieldMapping.source} is missing`)
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Clear all mappings
   */
  clear(): void {
    this.mappings.clear()
    this.reverseMappings.clear()
  }
}

// Export singleton instance
export const schemaMapper = new SchemaMapper()