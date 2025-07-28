/**
 * Development Guards Service - Main orchestrator for real-time development monitoring
 * Integrates file watching, guards, and WebSocket communication
 */

import { FileWatcherService, FileWatcherOptions } from './file-watcher'
import { DevGuardWebSocketServer } from './websocket-server'
import { OrganizationIsolationGuard } from './guards/organization-isolation'
import { RateLimitingGuard } from './guards/rate-limiting'
import { NPlusOneQueryGuard } from './guards/n-plus-one-query'
import { ErrorHandlingGuard } from './guards/error-handling'
import { Violation } from './ast-analyzer'

export interface DevGuardsConfig {
  enabled?: boolean
  websocketPort?: number
  fileWatcher?: FileWatcherOptions
  guards?: {
    organizationIsolation?: boolean
    rateLimiting?: boolean
    nPlusOneQuery?: boolean
    errorHandling?: boolean
  }
  verbose?: boolean
}

export class DevGuardsService {
  private fileWatcher: FileWatcherService
  private websocketServer: DevGuardWebSocketServer
  private config: Required<DevGuardsConfig>
  private isRunning: boolean = false

  constructor(config: DevGuardsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? (process.env.NODE_ENV === 'development'),
      websocketPort: config.websocketPort ?? 3001,
      fileWatcher: config.fileWatcher ?? {},
      guards: {
        organizationIsolation: config.guards?.organizationIsolation ?? true,
        rateLimiting: config.guards?.rateLimiting ?? true,
        nPlusOneQuery: config.guards?.nPlusOneQuery ?? true,
        errorHandling: config.guards?.errorHandling ?? true,
        ...config.guards
      },
      verbose: config.verbose ?? false
    }

    this.fileWatcher = new FileWatcherService({
      enabled: this.config.enabled,
      verbose: this.config.verbose,
      ...this.config.fileWatcher
    })

    this.websocketServer = new DevGuardWebSocketServer(this.config.websocketPort)

    this.setupGuards()
    this.setupEventHandlers()
  }

  /**
   * Setup development guards
   */
  private setupGuards(): void {
    if (this.config.guards.organizationIsolation) {
      this.fileWatcher.addGuard(new OrganizationIsolationGuard())
    }

    if (this.config.guards.rateLimiting) {
      this.fileWatcher.addGuard(new RateLimitingGuard())
    }

    if (this.config.guards.nPlusOneQuery) {
      this.fileWatcher.addGuard(new NPlusOneQueryGuard())
    }

    if (this.config.guards.errorHandling) {
      this.fileWatcher.addGuard(new ErrorHandlingGuard())
    }
  }

  /**
   * Setup event handlers between components
   */
  private setupEventHandlers(): void {
    // Forward violations from file watcher to WebSocket clients
    this.fileWatcher.onViolations((violations: Violation[], filePath: string) => {
      if (this.websocketServer.isRunning()) {
        this.websocketServer.broadcastViolations(filePath, violations)
      }
    })
  }

  /**
   * Start the development guards system
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('🛡️  Development guards disabled')
      return
    }

    if (this.isRunning) {
      console.warn('🛡️  Development guards already running')
      return
    }

    try {
      console.log('🚀 Starting Development Guards System...')

      // Start WebSocket server first
      await this.websocketServer.start()

      // Start file watcher
      await this.fileWatcher.start()

      this.isRunning = true
      
      console.log('✅ Development Guards System started successfully')
      console.log(`🔗 WebSocket server: ws://localhost:${this.config.websocketPort}`)
      console.log('🛡️  Real-time monitoring active')

      // Perform initial analysis of existing files
      if (this.config.verbose) {
        console.log('📊 Running initial file analysis...')
        const results = await this.fileWatcher.analyzeAllFiles()
        const totalViolations = Object.values(results).reduce((sum, violations) => sum + violations.length, 0)
        console.log(`📊 Initial analysis complete: ${totalViolations} violations found in ${Object.keys(results).length} files`)
      }

    } catch (error) {
      console.error('❌ Failed to start Development Guards System:', error)
      await this.stop()
      throw error
    }
  }

  /**
   * Stop the development guards system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    console.log('🛑 Stopping Development Guards System...')

    try {
      // Stop file watcher
      await this.fileWatcher.stop()

      // Stop WebSocket server
      await this.websocketServer.stop()

      this.isRunning = false
      console.log('✅ Development Guards System stopped')

    } catch (error) {
      console.error('❌ Error stopping Development Guards System:', error)
    }
  }

  /**
   * Get system status
   */
  getStatus(): {
    running: boolean
    fileWatcherStats: any
    websocketClients: number
    config: DevGuardsConfig
  } {
    return {
      running: this.isRunning,
      fileWatcherStats: this.fileWatcher.getStats(),
      websocketClients: this.websocketServer.getClientCount(),
      config: this.config
    }
  }

  /**
   * Manually analyze a specific file
   */
  async analyzeFile(filePath: string): Promise<Violation[]> {
    return this.fileWatcher.analyzeFileManually(filePath)
  }

  /**
   * Analyze all files and return results
   */
  async analyzeAllFiles(): Promise<{ [filePath: string]: Violation[] }> {
    return this.fileWatcher.analyzeAllFiles()
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DevGuardsConfig>): void {
    this.config = { ...this.config, ...updates }
    
    if (this.config.verbose) {
      console.log('🔧 Configuration updated:', updates)
    }
  }

  /**
   * Enable or disable specific guards
   */
  setGuardEnabled(guardName: string, enabled: boolean): void {
    // This would need to be implemented to dynamically enable/disable guards
    if (this.config.verbose) {
      console.log(`🛡️  Guard ${guardName} ${enabled ? 'enabled' : 'disabled'}`)
    }
  }
}

// Global instance for easy access
let globalDevGuards: DevGuardsService | null = null

/**
 * Get or create the global development guards instance
 */
export function getDevGuards(config?: DevGuardsConfig): DevGuardsService {
  if (!globalDevGuards) {
    globalDevGuards = new DevGuardsService(config)
  }
  return globalDevGuards
}

/**
 * Start development guards with default configuration
 */
export async function startDevGuards(config?: DevGuardsConfig): Promise<DevGuardsService> {
  const devGuards = getDevGuards(config)
  await devGuards.start()
  return devGuards
}

/**
 * Stop development guards
 */
export async function stopDevGuards(): Promise<void> {
  if (globalDevGuards) {
    await globalDevGuards.stop()
  }
}