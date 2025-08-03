import { DataConflict, Resolution, ERPEntity, ConflictSource } from './types'
import { Logger } from '@/lib/logger'

export interface ConflictRule {
  id: string
  name: string
  entity: ERPEntity
  type: DataConflict['type']
  condition: (conflict: DataConflict) => boolean
  resolution: (conflict: DataConflict) => Resolution
  priority: number
}

export interface ConflictResolutionStrategy {
  name: string
  description: string
  resolve: (conflict: DataConflict) => Resolution
}

export class ConflictResolver {
  private rules: ConflictRule[] = []
  private strategies: Map<string, ConflictResolutionStrategy> = new Map()
  private logger: Logger

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('ConflictResolver')
    this.registerDefaultStrategies()
  }

  /**
   * Register a conflict resolution rule
   */
  registerRule(rule: ConflictRule): void {
    this.rules.push(rule)
    // Sort rules by priority (higher priority first)
    this.rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Register a resolution strategy
   */
  registerStrategy(name: string, strategy: ConflictResolutionStrategy): void {
    this.strategies.set(name, strategy)
  }

  /**
   * Resolve a single conflict
   */
  async resolveConflict(conflict: DataConflict): Promise<Resolution> {
    this.logger.info(`Resolving conflict ${conflict.id} for ${conflict.entity}:${conflict.entityId}`)

    // Check rules first
    const applicableRule = this.findApplicableRule(conflict)
    if (applicableRule) {
      this.logger.debug(`Applying rule: ${applicableRule.name}`)
      const resolution = applicableRule.resolution(conflict)
      resolution.reason = `Applied rule: ${applicableRule.name} - ${resolution.reason}`
      return resolution
    }

    // Apply default strategy based on conflict type
    const strategy = this.getDefaultStrategy(conflict.type)
    if (strategy) {
      this.logger.debug(`Applying strategy: ${strategy.name}`)
      return strategy.resolve(conflict)
    }

    // Fallback to manual review
    return {
      conflictId: conflict.id,
      action: 'manual_review',
      reason: 'No applicable rules or strategies found',
    }
  }

  /**
   * Resolve multiple conflicts
   */
  async resolveConflicts(conflicts: DataConflict[]): Promise<Resolution[]> {
    const resolutions: Resolution[] = []

    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(conflict)
        resolutions.push(resolution)
      } catch (error) {
        this.logger.error(`Error resolving conflict ${conflict.id}`, error)
        resolutions.push({
          conflictId: conflict.id,
          action: 'manual_review',
          reason: `Error during resolution: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    }

    return resolutions
  }

  /**
   * Find applicable rule for a conflict
   */
  private findApplicableRule(conflict: DataConflict): ConflictRule | undefined {
    return this.rules.find(rule =>
      rule.entity === conflict.entity &&
      rule.type === conflict.type &&
      rule.condition(conflict)
    )
  }

  /**
   * Get default strategy for conflict type
   */
  private getDefaultStrategy(type: DataConflict['type']): ConflictResolutionStrategy | undefined {
    const strategyMap: Record<DataConflict['type'], string> = {
      'update_conflict': 'last_write_wins',
      'duplicate': 'merge_duplicates',
      'missing_reference': 'create_reference',
      'validation_error': 'use_valid_source',
    }

    const strategyName = strategyMap[type]
    return strategyName ? this.strategies.get(strategyName) : undefined
  }

  /**
   * Register default resolution strategies
   */
  private registerDefaultStrategies(): void {
    // Last write wins strategy
    this.registerStrategy('last_write_wins', {
      name: 'Last Write Wins',
      description: 'Accept the most recent update',
      resolve: (conflict) => {
        const mostRecent = conflict.sources.reduce((latest, source) =>
          source.timestamp > latest.timestamp ? source : latest
        )

        return {
          conflictId: conflict.id,
          action: 'accept',
          source: mostRecent,
          reason: `Accepted most recent update from ${mostRecent.erp} at ${mostRecent.timestamp.toISOString()}`,
        }
      },
    })

    // Merge duplicates strategy
    this.registerStrategy('merge_duplicates', {
      name: 'Merge Duplicates',
      description: 'Merge duplicate records into one',
      resolve: (conflict) => {
        const mergedData = this.mergeData(conflict.sources)

        return {
          conflictId: conflict.id,
          action: 'merge',
          mergedData,
          reason: `Merged ${conflict.sources.length} duplicate records`,
        }
      },
    })

    // Create missing reference
    this.registerStrategy('create_reference', {
      name: 'Create Reference',
      description: 'Create missing reference data',
      resolve: (conflict) => {
        return {
          conflictId: conflict.id,
          action: 'manual_review',
          reason: 'Missing reference requires manual creation',
        }
      },
    })

    // Use valid source
    this.registerStrategy('use_valid_source', {
      name: 'Use Valid Source',
      description: 'Use the source that passes validation',
      resolve: (conflict) => {
        // In a real implementation, you would validate each source
        // For now, we'll use the first source
        const validSource = conflict.sources[0]

        return {
          conflictId: conflict.id,
          action: 'accept',
          source: validSource,
          reason: `Accepted valid data from ${validSource.erp}`,
        }
      },
    })

    // Master data priority
    this.registerStrategy('master_data_priority', {
      name: 'Master Data Priority',
      description: 'Prioritize designated master data source',
      resolve: (conflict) => {
        // Define ERP priority order
        const erpPriority = ['SAP', 'NETSUITE', 'DYNAMICS365', 'ORACLE_CLOUD']
        
        const prioritySource = conflict.sources.sort((a, b) => {
          const aPriority = erpPriority.indexOf(a.erp)
          const bPriority = erpPriority.indexOf(b.erp)
          return aPriority - bPriority
        })[0]

        return {
          conflictId: conflict.id,
          action: 'accept',
          source: prioritySource,
          reason: `Accepted data from master source ${prioritySource.erp}`,
        }
      },
    })

    // Field-level merge
    this.registerStrategy('field_level_merge', {
      name: 'Field Level Merge',
      description: 'Merge at field level, taking non-null values',
      resolve: (conflict) => {
        const mergedData = this.fieldLevelMerge(conflict.sources)

        return {
          conflictId: conflict.id,
          action: 'merge',
          mergedData,
          reason: 'Performed field-level merge of all sources',
        }
      },
    })
  }

  /**
   * Merge data from multiple sources
   */
  private mergeData(sources: ConflictSource[]): any {
    if (sources.length === 0) return {}
    if (sources.length === 1) return sources[0].data

    // Start with the most recent source
    const sortedSources = [...sources].sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    )

    let merged = { ...sortedSources[0].data }

    // Merge other sources
    for (let i = 1; i < sortedSources.length; i++) {
      const source = sortedSources[i].data
      
      // Deep merge
      merged = this.deepMerge(merged, source)
    }

    return merged
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target }

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (this.isObject(source[key]) && this.isObject(target[key])) {
          output[key] = this.deepMerge(target[key], source[key])
        } else if (source[key] !== null && source[key] !== undefined) {
          output[key] = source[key]
        }
      }
    }

    return output
  }

  /**
   * Field-level merge taking non-null values
   */
  private fieldLevelMerge(sources: ConflictSource[]): any {
    if (sources.length === 0) return {}
    
    const merged: any = {}
    const allKeys = new Set<string>()

    // Collect all keys
    sources.forEach(source => {
      Object.keys(source.data).forEach(key => allKeys.add(key))
    })

    // For each key, take the non-null value with the highest priority
    allKeys.forEach(key => {
      for (const source of sources) {
        const value = source.data[key]
        if (value !== null && value !== undefined && value !== '') {
          merged[key] = value
          break
        }
      }
    })

    return merged
  }

  /**
   * Check if value is an object
   */
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item)
  }

  /**
   * Create default rules for common scenarios
   */
  createDefaultRules(): void {
    // Product master data rule
    this.registerRule({
      id: 'product-master-sap',
      name: 'SAP as Product Master',
      entity: 'products',
      type: 'update_conflict',
      condition: (conflict) => 
        conflict.sources.some(s => s.erp === 'SAP'),
      resolution: (conflict) => {
        const sapSource = conflict.sources.find(s => s.erp === 'SAP')!
        return {
          conflictId: conflict.id,
          action: 'accept',
          source: sapSource,
          reason: 'SAP is designated as product master',
        }
      },
      priority: 100,
    })

    // Inventory real-time rule
    this.registerRule({
      id: 'inventory-most-recent',
      name: 'Most Recent Inventory',
      entity: 'inventory',
      type: 'update_conflict',
      condition: () => true,
      resolution: (conflict) => {
        const mostRecent = conflict.sources.reduce((latest, source) =>
          source.timestamp > latest.timestamp ? source : latest
        )
        return {
          conflictId: conflict.id,
          action: 'accept',
          source: mostRecent,
          reason: 'Inventory requires real-time accuracy',
        }
      },
      priority: 90,
    })

    // Customer deduplication rule
    this.registerRule({
      id: 'customer-dedup-email',
      name: 'Customer Deduplication by Email',
      entity: 'customers',
      type: 'duplicate',
      condition: (conflict) => {
        const emails = conflict.sources.map(s => s.data.email?.toLowerCase())
        return new Set(emails).size === 1
      },
      resolution: (conflict) => {
        const mergedData = this.fieldLevelMerge(conflict.sources)
        return {
          conflictId: conflict.id,
          action: 'merge',
          mergedData,
          reason: 'Merged customers with same email',
        }
      },
      priority: 80,
    })
  }
}