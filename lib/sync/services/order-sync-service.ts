// Mock order sync service for testing
export class OrderSyncService {
  constructor() {
    // Mock implementation
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