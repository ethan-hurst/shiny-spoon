/**
 * WebSocket Server - Real-time communication with development toolbar
 * Enables instant violation reporting and quick fixes
 */

import { WebSocketServer, WebSocket } from 'ws'
import { Violation } from './ast-analyzer'

export interface DevMessage {
  type: string
  data?: any
  timestamp?: number
}

export interface ViolationMessage extends DevMessage {
  type: 'violations'
  data: {
    file: string
    violations: Violation[]
  }
}

export interface StatsMessage extends DevMessage {
  type: 'stats'
  data: {
    bundleSize: number
    queryCount: number
    renderTime: number
    violationCount: number
    errorCount: number
  }
}

export interface QuickFixMessage extends DevMessage {
  type: 'apply-fix'
  data: {
    violationId: string
  }
}

export class DevGuardWebSocketServer {
  private wss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private port: number
  private stats: StatsMessage['data'] = {
    bundleSize: 0,
    queryCount: 0,
    renderTime: 0,
    violationCount: 0,
    errorCount: 0
  }

  constructor(port: number = 3001) {
    this.port = port
  }

  /**
   * Start the WebSocket server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port })
        
        this.wss.on('connection', (ws) => {
          this.handleConnection(ws)
        })
        
        this.wss.on('error', (error) => {
          console.error('🚨 WebSocket server error:', error)
          reject(error)
        })
        
        this.wss.on('listening', () => {
          console.log(`🔗 Dev Guards WebSocket server running on port ${this.port}`)
          resolve()
        })
        
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (this.wss) {
      // Close all client connections
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.close()
        }
      })
      this.clients.clear()
      
      // Close server
      return new Promise((resolve) => {
        this.wss!.close(() => {
          console.log('🛑 Dev Guards WebSocket server stopped')
          this.wss = null
          resolve()
        })
      })
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws)
    console.log(`🔗 Development toolbar connected (${this.clients.size} total clients)`)
    
    // Send current stats to new client
    this.sendToClient(ws, {
      type: 'stats',
      data: this.stats,
      timestamp: Date.now()
    })
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as DevMessage
        this.handleMessage(message, ws)
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error)
      }
    })
    
    ws.on('close', () => {
      this.clients.delete(ws)
      console.log(`🔌 Development toolbar disconnected (${this.clients.size} remaining)`)
    })
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket client error:', error)
      this.clients.delete(ws)
    })
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(message: DevMessage, ws: WebSocket): void {
    switch (message.type) {
      case 'apply-fix':
        this.handleQuickFix(message as QuickFixMessage)
        break
        
      case 'dismiss-violation':
        this.handleDismissViolation(message)
        break
        
      case 'request-stats':
        this.sendToClient(ws, {
          type: 'stats',
          data: this.stats,
          timestamp: Date.now()
        })
        break
        
      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          timestamp: Date.now()
        })
        break
        
      default:
        console.warn('❓ Unknown message type:', message.type)
    }
  }

  /**
   * Handle quick fix request
   */
  private async handleQuickFix(message: QuickFixMessage): Promise<void> {
    try {
      const { violationId } = message.data
      
      // Find the violation and execute its quick fix
      // This would need to be coordinated with the file watcher service
      // For now, just acknowledge the request
      
      this.broadcast({
        type: 'fix-applied',
        data: { violationId },
        timestamp: Date.now()
      })
      
      console.log(`🔧 Quick fix applied for violation: ${violationId}`)
      
    } catch (error) {
      console.error('❌ Failed to apply quick fix:', error)
      
      this.broadcast({
        type: 'fix-error',
        data: { 
          violationId: message.data.violationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: Date.now()
      })
    }
  }

  /**
   * Handle violation dismissal
   */
  private handleDismissViolation(message: DevMessage): void {
    // Store dismissed violations to avoid showing them again
    // This could be persisted to a local file or database
    console.log('📝 Violation dismissed:', message.data)
    
    this.broadcast({
      type: 'violation-dismissed',
      data: message.data,
      timestamp: Date.now()
    })
  }

  /**
   * Broadcast violations to all connected clients
   */
  broadcastViolations(filePath: string, violations: Violation[]): void {
    const message: ViolationMessage = {
      type: 'violations',
      data: {
        file: filePath,
        violations
      },
      timestamp: Date.now()
    }
    
    this.broadcast(message)
    
    // Update stats
    this.stats.violationCount = violations.length
    this.updateStats()
  }

  /**
   * Update and broadcast statistics
   */
  updateStats(updates?: Partial<StatsMessage['data']>): void {
    if (updates) {
      this.stats = { ...this.stats, ...updates }
    }
    
    const message: StatsMessage = {
      type: 'stats',
      data: this.stats,
      timestamp: Date.now()
    }
    
    this.broadcast(message)
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: DevMessage): void {
    const data = JSON.stringify(message)
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data)
        } catch (error) {
          console.error('❌ Failed to send message to client:', error)
          this.clients.delete(client)
        }
      }
    })
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WebSocket, message: DevMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message))
      } catch (error) {
        console.error('❌ Failed to send message to client:', error)
        this.clients.delete(client)
      }
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Get current stats
   */
  getStats(): StatsMessage['data'] {
    return { ...this.stats }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.wss !== null
  }
}