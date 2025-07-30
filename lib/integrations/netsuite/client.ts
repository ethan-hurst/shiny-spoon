// Mock NetSuite client for testing
export class NetSuiteApiClient {
  constructor(config: any) {
    // Mock implementation
  }

  async getProducts() {
    return { data: [] }
  }

  async getInventory() {
    return { data: [] }
  }

  async updateInventory() {
    return { success: true }
  }
}

export function createNetSuiteClient(config: any) {
  return new NetSuiteApiClient(config)
}