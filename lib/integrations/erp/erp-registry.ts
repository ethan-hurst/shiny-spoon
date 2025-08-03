import { BaseERPConnector, ConnectorOptions } from './base-erp-connector'
import { ERPType, ERPConfig, ERPInfo, ERP_METADATA } from './types'

export type ERPConnectorFactory<T extends ERPConfig = ERPConfig> = (
  config: T,
  options?: ConnectorOptions
) => BaseERPConnector<T>

export class ERPRegistry {
  private static instance: ERPRegistry
  private connectors = new Map<ERPType, ERPConnectorFactory<any>>()
  private activeConnectors = new Map<string, BaseERPConnector>()

  private constructor() {}

  static getInstance(): ERPRegistry {
    if (!ERPRegistry.instance) {
      ERPRegistry.instance = new ERPRegistry()
    }
    return ERPRegistry.instance
  }

  /**
   * Register a connector factory for an ERP type
   */
  register<T extends ERPConfig>(
    type: ERPType,
    factory: ERPConnectorFactory<T>
  ): void {
    if (this.connectors.has(type)) {
      throw new Error(`Connector for ${type} is already registered`)
    }
    
    this.connectors.set(type, factory)
  }

  /**
   * Unregister a connector factory
   */
  unregister(type: ERPType): void {
    this.connectors.delete(type)
    
    // Disconnect any active connectors of this type
    for (const [id, connector] of this.activeConnectors.entries()) {
      if (connector.config.type === type) {
        connector.disconnect().catch(console.error)
        this.activeConnectors.delete(id)
      }
    }
  }

  /**
   * Create a new connector instance
   */
  create<T extends ERPConfig>(
    config: T,
    options?: ConnectorOptions
  ): BaseERPConnector<T> {
    const factory = this.connectors.get(config.type)
    if (!factory) {
      throw new Error(`No connector registered for ERP type: ${config.type}`)
    }
    
    return factory(config, options)
  }

  /**
   * Create and manage a connector instance
   */
  async createAndConnect<T extends ERPConfig>(
    id: string,
    config: T,
    options?: ConnectorOptions
  ): Promise<BaseERPConnector<T>> {
    // Check if already exists
    if (this.activeConnectors.has(id)) {
      throw new Error(`Connector with id ${id} already exists`)
    }
    
    // Create connector
    const connector = this.create(config, options)
    
    // Connect
    await connector.connect()
    
    // Store active connector
    this.activeConnectors.set(id, connector)
    
    // Setup cleanup on disconnect
    connector.on('disconnect', () => {
      this.activeConnectors.delete(id)
    })
    
    return connector
  }

  /**
   * Get an active connector by ID
   */
  getConnector(id: string): BaseERPConnector | undefined {
    return this.activeConnectors.get(id)
  }

  /**
   * Get all active connectors
   */
  getActiveConnectors(): Map<string, BaseERPConnector> {
    return new Map(this.activeConnectors)
  }

  /**
   * Disconnect and remove a connector
   */
  async disconnect(id: string): Promise<void> {
    const connector = this.activeConnectors.get(id)
    if (connector) {
      await connector.disconnect()
      this.activeConnectors.delete(id)
    }
  }

  /**
   * Disconnect all active connectors
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.activeConnectors.values()).map(
      connector => connector.disconnect()
    )
    
    await Promise.allSettled(promises)
    this.activeConnectors.clear()
  }

  /**
   * Get supported ERP types
   */
  getSupportedERPs(): ERPInfo[] {
    return Array.from(this.connectors.keys()).map(type => ({
      ...ERP_METADATA[type],
      registered: true,
    }))
  }

  /**
   * Get all ERP metadata (including unregistered)
   */
  getAllERPMetadata(): Record<ERPType, ERPInfo & { registered: boolean }> {
    const result: Record<string, ERPInfo & { registered: boolean }> = {}
    
    // Add all metadata
    for (const [type, info] of Object.entries(ERP_METADATA)) {
      result[type] = {
        ...info,
        registered: this.connectors.has(type as ERPType),
      }
    }
    
    return result as Record<ERPType, ERPInfo & { registered: boolean }>
  }

  /**
   * Check if an ERP type is supported
   */
  isSupported(type: ERPType): boolean {
    return this.connectors.has(type)
  }

  /**
   * Get health status of all active connectors
   */
  async getHealthStatus(): Promise<
    Array<{
      id: string
      health: {
        connected: boolean
        type: ERPType
        name: string
        lastSync?: Date
        uptime: number
      }
    }>
  > {
    const results = await Promise.all(
      Array.from(this.activeConnectors.entries()).map(async ([id, connector]) => {
        try {
          const health = await connector.getHealth()
          return { id, health }
        } catch (error) {
          return {
            id,
            health: {
              connected: false,
              type: connector.config.type,
              name: connector.config.name,
              lastSync: connector.config.lastSync,
              uptime: 0,
            },
          }
        }
      })
    )
    
    return results
  }

  /**
   * Register default connectors
   */
  async registerDefaults(): Promise<void> {
    // Dynamically import and register connectors
    try {
      // SAP
      const { SAPConnector } = await import('./sap/sap-connector')
      this.register('SAP', (config, options) => new SAPConnector(config, options))
    } catch (error) {
      console.warn('Failed to register SAP connector:', error)
    }

    try {
      // NetSuite
      const { NetSuiteConnector } = await import('./netsuite/netsuite-connector')
      this.register('NETSUITE', (config, options) => new NetSuiteConnector(config, options))
    } catch (error) {
      console.warn('Failed to register NetSuite connector:', error)
    }

    try {
      // Dynamics 365
      const { Dynamics365Connector } = await import('./dynamics365/dynamics-connector')
      this.register('DYNAMICS365', (config, options) => new Dynamics365Connector(config, options))
    } catch (error) {
      console.warn('Failed to register Dynamics 365 connector:', error)
    }
  }
}

// Export singleton instance
export const erpRegistry = ERPRegistry.getInstance()