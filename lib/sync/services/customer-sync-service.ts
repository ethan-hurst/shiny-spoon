// Mock customer sync service for testing
export class CustomerSyncService {
  constructor() {
    // Mock implementation
  }

  async syncCustomers() {
    return { success: true, syncedCustomers: [] }
  }

  async updateCustomerData() {
    return { success: true, updatedCustomers: [] }
  }
}

export function createCustomerSyncService() {
  return new CustomerSyncService()
}