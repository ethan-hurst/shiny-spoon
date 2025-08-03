import { EventEmitter } from 'events'
import { BaseERPConnector } from './base-erp-connector'
import { erpRegistry } from './erp-registry'
import { ConflictResolver } from './conflict-resolver'
import { schemaMapper } from './transformers/schema-mapper'
import {
  ERPType,
  ERPConfig,
  ERPEntity,
  DataConflict,
  Product,
  ProductQuery,
  Inventory,
  InventoryQuery,
  Order,
  OrderQuery,
  Customer,
  CustomerQuery,
} from './types'
import { Logger } from '@/lib/logger'

export interface ERPConnection {
  id: string
  type: ERPType
  config: ERPConfig
  connector: BaseERPConnector
  priority: number
  isActive: boolean
  lastSync?: Date
  syncErrors: number
}

export interface SyncStrategy {
  type: 'full' | 'incremental' | 'real-time'
  interval?: number // minutes
  entities: ERPEntity[]
  conflictResolution: 'last-write-wins' | 'merge' | 'manual' | 'master-wins'
  masterERP?: string
}

export interface SyncResult {
  erpId: string
  entity: ERPEntity
  success: number
  failed: number
  conflicts: number
  duration: number
  errors: any[]
}

export class ERPOrchestrator extends EventEmitter {
  private connections: Map<string, ERPConnection> = new Map()
  private conflictResolver: ConflictResolver
  private logger: Logger
  private syncInProgress: boolean = false
  private syncSchedules: Map<string, NodeJS.Timeout> = new Map()

  constructor(logger?: Logger) {
    super()
    this.logger = logger || new Logger('ERPOrchestrator')
    this.conflictResolver = new ConflictResolver(this.logger)
    this.conflictResolver.createDefaultRules()
  }

  /**
   * Add an ERP connection
   */
  async addERP(
    id: string,
    type: ERPType,
    config: ERPConfig,
    priority: number = 50
  ): Promise<ERPConnection> {
    if (this.connections.has(id)) {
      throw new Error(`ERP connection ${id} already exists`)
    }

    try {
      // Create connector
      const connector = await erpRegistry.createAndConnect(id, config)
      
      // Test connection
      const isConnected = await connector.testConnection()
      if (!isConnected) {
        throw new Error('Connection test failed')
      }

      // Create connection object
      const connection: ERPConnection = {
        id,
        type,
        config,
        connector,
        priority,
        isActive: true,
        syncErrors: 0,
      }

      // Store connection
      this.connections.set(id, connection)
      
      // Setup event listeners
      this.setupConnectorEvents(connection)
      
      this.logger.info(`Added ERP connection: ${id} (${type})`)
      this.emit('erp-added', connection)
      
      return connection
    } catch (error) {
      this.logger.error(`Failed to add ERP ${id}`, error)
      throw error
    }
  }

  /**
   * Remove an ERP connection
   */
  async removeERP(id: string): Promise<void> {
    const connection = this.connections.get(id)
    if (!connection) {
      throw new Error(`ERP connection ${id} not found`)
    }

    try {
      // Stop any scheduled syncs
      this.stopSyncSchedule(id)
      
      // Disconnect
      await connection.connector.disconnect()
      
      // Remove from connections
      this.connections.delete(id)
      
      this.logger.info(`Removed ERP connection: ${id}`)
      this.emit('erp-removed', id)
    } catch (error) {
      this.logger.error(`Failed to remove ERP ${id}`, error)
      throw error
    }
  }

  /**
   * Get all active connections
   */
  getConnections(): ERPConnection[] {
    return Array.from(this.connections.values()).filter(c => c.isActive)
  }

  /**
   * Get connection by ID
   */
  getConnection(id: string): ERPConnection | undefined {
    return this.connections.get(id)
  }

  /**
   * Configure sync strategy for an ERP
   */
  configureSyncStrategy(erpId: string, strategy: SyncStrategy): void {
    const connection = this.connections.get(erpId)
    if (!connection) {
      throw new Error(`ERP connection ${erpId} not found`)
    }

    // Store strategy
    connection.config.syncStrategy = strategy

    // Setup scheduled sync if needed
    if (strategy.type !== 'real-time' && strategy.interval) {
      this.setupSyncSchedule(erpId, strategy.interval)
    }

    this.logger.info(`Configured sync strategy for ${erpId}:`, strategy)
  }

  /**
   * Sync all ERPs
   */
  async syncAll(entity?: ERPEntity): Promise<SyncResult[]> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress')
    }

    this.syncInProgress = true
    this.emit('sync-started', { entity })

    try {
      const results: SyncResult[] = []
      const entities = entity ? [entity] : ['products', 'inventory', 'orders', 'customers'] as ERPEntity[]

      for (const ent of entities) {
        const entityResults = await this.syncEntity(ent)
        results.push(...entityResults)
      }

      this.emit('sync-completed', results)
      return results
    } catch (error) {
      this.emit('sync-failed', error)
      throw error
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Sync a specific entity across all ERPs
   */
  private async syncEntity(entity: ERPEntity): Promise<SyncResult[]> {
    const results: SyncResult[] = []
    const allData: Map<string, any[]> = new Map()

    // Fetch data from all ERPs
    for (const connection of this.getConnections()) {
      try {
        const data = await this.fetchEntityData(connection, entity)
        allData.set(connection.id, data)
        
        results.push({
          erpId: connection.id,
          entity,
          success: data.length,
          failed: 0,
          conflicts: 0,
          duration: 0,
          errors: [],
        })
      } catch (error) {
        this.logger.error(`Failed to fetch ${entity} from ${connection.id}`, error)
        results.push({
          erpId: connection.id,
          entity,
          success: 0,
          failed: 1,
          conflicts: 0,
          duration: 0,
          errors: [error],
        })
      }
    }

    // Detect and resolve conflicts
    const conflicts = await this.detectConflicts(entity, allData)
    if (conflicts.length > 0) {
      const resolutions = await this.conflictResolver.resolveConflicts(conflicts)
      this.emit('conflicts-resolved', { entity, conflicts, resolutions })
    }

    // Sync resolved data back to ERPs
    await this.syncResolvedData(entity, allData, results)

    return results
  }

  /**
   * Fetch entity data from a connection
   */
  private async fetchEntityData(
    connection: ERPConnection,
    entity: ERPEntity
  ): Promise<any[]> {
    const params = this.getDefaultQueryParams()

    switch (entity) {
      case 'products':
        return await connection.connector.getProducts(params)
      case 'inventory':
        return await connection.connector.getInventory(params)
      case 'orders':
        return await connection.connector.getOrders(params)
      case 'customers':
        return await connection.connector.getCustomers(params)
      default:
        throw new Error(`Unknown entity: ${entity}`)
    }
  }

  /**
   * Detect conflicts between multiple data sources
   */
  private async detectConflicts(
    entity: ERPEntity,
    allData: Map<string, any[]>
  ): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = []
    const entityMap: Map<string, ConflictSource[]> = new Map()

    // Group data by entity ID
    for (const [erpId, data] of allData.entries()) {
      const connection = this.connections.get(erpId)!
      
      for (const item of data) {
        const entityId = item.id
        if (!entityMap.has(entityId)) {
          entityMap.set(entityId, [])
        }
        
        entityMap.get(entityId)!.push({
          erp: connection.type,
          data: item,
          timestamp: new Date(),
          version: item.version || '1',
        })
      }
    }

    // Detect conflicts
    for (const [entityId, sources] of entityMap.entries()) {
      if (sources.length > 1) {
        // Check if data differs
        const hasConflict = this.hasDataConflict(sources)
        
        if (hasConflict) {
          conflicts.push({
            id: `${entity}-${entityId}-${Date.now()}`,
            type: 'update_conflict',
            entity,
            entityId,
            sources,
            detectedAt: new Date(),
            status: 'pending',
          })
        }
      }
    }

    return conflicts
  }

  /**
   * Check if sources have conflicting data
   */
  private hasDataConflict(sources: ConflictSource[]): boolean {
    if (sources.length < 2) return false

    // Compare key fields (simplified)
    const firstData = sources[0].data
    
    for (let i = 1; i < sources.length; i++) {
      const data = sources[i].data
      
      // Compare relevant fields based on entity type
      if (
        data.name !== firstData.name ||
        data.price !== firstData.price ||
        data.quantity !== firstData.quantity
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Sync resolved data back to ERPs
   */
  private async syncResolvedData(
    entity: ERPEntity,
    allData: Map<string, any[]>,
    results: SyncResult[]
  ): Promise<void> {
    // In a real implementation, this would sync the resolved
    // data back to ERPs that need updates
    this.logger.info(`Syncing resolved ${entity} data`)
  }

  /**
   * Setup connector event listeners
   */
  private setupConnectorEvents(connection: ERPConnection): void {
    connection.connector.on('erp-event', (event) => {
      this.handleERPEvent(connection.id, event)
    })

    connection.connector.on('metric', (metric) => {
      this.emit('metric', {
        ...metric,
        erpId: connection.id,
      })
    })

    connection.connector.on('error', (error) => {
      connection.syncErrors++
      this.logger.error(`Error from ${connection.id}:`, error)
    })
  }

  /**
   * Handle ERP events
   */
  private handleERPEvent(erpId: string, event: any): void {
    this.logger.debug(`Event from ${erpId}:`, event)
    
    // Trigger sync if needed
    if (event.type.includes('created') || event.type.includes('updated')) {
      const entity = event.type.split('.')[0] as ERPEntity
      this.scheduleDeferredSync(entity)
    }
    
    this.emit('erp-event', { erpId, event })
  }

  /**
   * Setup sync schedule
   */
  private setupSyncSchedule(erpId: string, intervalMinutes: number): void {
    // Clear existing schedule
    this.stopSyncSchedule(erpId)

    // Create new schedule
    const interval = setInterval(() => {
      this.syncERP(erpId).catch(error => {
        this.logger.error(`Scheduled sync failed for ${erpId}:`, error)
      })
    }, intervalMinutes * 60 * 1000)

    this.syncSchedules.set(erpId, interval)
  }

  /**
   * Stop sync schedule
   */
  private stopSyncSchedule(erpId: string): void {
    const interval = this.syncSchedules.get(erpId)
    if (interval) {
      clearInterval(interval)
      this.syncSchedules.delete(erpId)
    }
  }

  /**
   * Sync a specific ERP
   */
  private async syncERP(erpId: string): Promise<void> {
    const connection = this.connections.get(erpId)
    if (!connection || !connection.isActive) return

    const strategy = connection.config.syncStrategy
    if (!strategy) return

    for (const entity of strategy.entities) {
      await this.syncEntity(entity)
    }

    connection.lastSync = new Date()
  }

  /**
   * Schedule deferred sync
   */
  private scheduleDeferredSync(entity: ERPEntity): void {
    // Implement deferred sync logic
    // This would batch multiple events together
  }

  /**
   * Get default query parameters
   */
  private getDefaultQueryParams(): any {
    return {
      limit: 1000,
      modifiedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    }
  }

  /**
   * Query products across all ERPs
   */
  async queryProducts(params: ProductQuery): Promise<Product[]> {
    const allProducts: Product[] = []
    const productMap = new Map<string, Product>()

    for (const connection of this.getConnections()) {
      try {
        const products = await connection.connector.getProducts(params)
        
        for (const product of products) {
          const existing = productMap.get(product.id)
          if (existing) {
            // Merge or handle duplicate
            this.logger.warn(`Duplicate product ${product.id} found in ${connection.id}`)
          } else {
            productMap.set(product.id, product)
          }
        }
      } catch (error) {
        this.logger.error(`Failed to query products from ${connection.id}`, error)
      }
    }

    return Array.from(productMap.values())
  }

  /**
   * Get health status of all connections
   */
  async getHealthStatus(): Promise<any[]> {
    const statuses = []

    for (const connection of this.connections.values()) {
      try {
        const health = await connection.connector.getHealth()
        statuses.push({
          id: connection.id,
          ...health,
          syncErrors: connection.syncErrors,
          lastSync: connection.lastSync,
        })
      } catch (error) {
        statuses.push({
          id: connection.id,
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return statuses
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    // Stop all schedules
    for (const erpId of this.syncSchedules.keys()) {
      this.stopSyncSchedule(erpId)
    }

    // Disconnect all ERPs
    const disconnectPromises = Array.from(this.connections.keys()).map(id =>
      this.removeERP(id)
    )

    await Promise.allSettled(disconnectPromises)
    this.logger.info('ERP Orchestrator shutdown complete')
  }
}