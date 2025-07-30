// Mock order sync service for testing
export class OrderSyncService {
  constructor() {
    // Mock implementation
  }

  async sync(job: any, onProgress?: (progress: number) => void): Promise<any> {
    return {
      success: true,
      records_processed: 0,
      records_created: 0,
      records_updated: 0,
      records_failed: 0,
      errors: []
    }
  }

  async updateTargetRecord(system: string, recordId: string, data: any): Promise<any> {
    return { success: true }
  }

  async syncOrders() {
    return { success: true, syncedOrders: [] }
  }

  async updateOrderStatus() {
    return { success: true, updatedOrders: [] }
  }
}

export function createOrderSyncService() {
  return new OrderSyncService()
}