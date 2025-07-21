import { IndexedDBWrapper, DBConfig } from '@/lib/storage/indexed-db'
import { QueuedOperation, ProcessResult, ConnectionStatus } from './types'
import { createClient } from '@/lib/supabase/client'
import { RealtimeConnectionManager } from './connection-manager'

const DB_CONFIG: DBConfig = {
  name: 'truthsource-offline',
  version: 1,
  stores: [
    {
      name: 'operations',
      keyPath: 'id',
      indexes: [
        { name: 'timestamp', keyPath: 'timestamp' },
        { name: 'table', keyPath: 'table' },
        { name: 'type', keyPath: 'type' }
      ]
    }
  ]
}

export class OfflineQueue {
  private static instance: OfflineQueue | null = null
  private db: IndexedDBWrapper
  private processing: boolean = false
  private connectionManager: RealtimeConnectionManager
  private supabase = createClient()
  private listeners: Map<string, (count: number) => void> = new Map()

  private constructor() {
    this.db = new IndexedDBWrapper(DB_CONFIG)
    this.connectionManager = RealtimeConnectionManager.getInstance()
    
    // Listen for connection changes
    this.connectionManager.subscribe('offline-queue', (status) => {
      if (status.state === 'connected' && !this.processing) {
        this.processQueue()
      }
    })
  }

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue()
    }
    return OfflineQueue.instance
  }

  async addToQueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0
    }

    await this.db.add('operations', queuedOp)
    await this.notifyListeners()
    
    // Try to process immediately if connected
    const status = this.connectionManager.getStatus()
    if (status.state === 'connected' && !this.processing) {
      this.processQueue()
    }
  }

  async processQueue(): Promise<ProcessResult> {
    if (this.processing) {
      return { successful: [], failed: [], conflicts: [] }
    }

    this.processing = true
    const result: ProcessResult = {
      successful: [],
      failed: [],
      conflicts: []
    }

    try {
      const operations = await this.db.getAll<QueuedOperation>('operations')
      
      // Sort by timestamp to maintain order
      operations.sort((a, b) => a.timestamp - b.timestamp)

      for (const operation of operations) {
        try {
          await this.executeOperation(operation)
          result.successful.push(operation.id)
          await this.db.delete('operations', operation.id)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          // Check if it's a conflict
          if (errorMessage.includes('conflict') || errorMessage.includes('version')) {
            const serverValue = await this.fetchServerValue(operation.table, operation.data.id)
            result.conflicts.push({
              id: operation.id,
              localValue: operation.data,
              serverValue
            })
          } else {
            // Regular error - retry logic
            operation.retries++
            operation.error = errorMessage
            
            if (operation.retries >= 3) {
              result.failed.push({ id: operation.id, error: errorMessage })
              await this.db.delete('operations', operation.id)
            } else {
              await this.db.put('operations', operation)
            }
          }
        }
      }
    } finally {
      this.processing = false
      await this.notifyListeners()
    }

    return result
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    const { type, table, data } = operation

    switch (type) {
      case 'UPDATE':
        const { error: updateError } = await this.supabase
          .from(table)
          .update(data)
          .eq('id', data.id)
        
        if (updateError) throw updateError
        break

      case 'INSERT':
        const { error: insertError } = await this.supabase
          .from(table)
          .insert(data)
        
        if (insertError) throw insertError
        break

      case 'DELETE':
        const { error: deleteError } = await this.supabase
          .from(table)
          .delete()
          .eq('id', data.id)
        
        if (deleteError) throw deleteError
        break
    }
  }

  private async fetchServerValue(table: string, id: string): Promise<any> {
    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async getQueuedOperations(): Promise<QueuedOperation[]> {
    return this.db.getAll('operations')
  }

  async getQueueSize(): Promise<number> {
    return this.db.count('operations')
  }

  async clearQueue(): Promise<void> {
    await this.db.clear('operations')
    await this.notifyListeners()
  }

  async removeOperation(id: string): Promise<void> {
    await this.db.delete('operations', id)
    await this.notifyListeners()
  }

  subscribe(id: string, callback: (count: number) => void): () => void {
    this.listeners.set(id, callback)
    
    // Send initial count
    this.getQueueSize().then(count => callback(count))
    
    return () => {
      this.listeners.delete(id)
    }
  }

  private async notifyListeners(): Promise<void> {
    const count = await this.getQueueSize()
    this.listeners.forEach(callback => callback(count))
  }

  destroy(): void {
    this.db.close()
    this.listeners.clear()
    OfflineQueue.instance = null
  }
}