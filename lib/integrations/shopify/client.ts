// Mock Shopify client for testing
export class ShopifyApiClient {
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

export function createShopifyClient(config: any) {
  return new ShopifyApiClient(config)
}