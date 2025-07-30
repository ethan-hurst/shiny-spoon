// Mock pricing sync service for testing
export class PricingSyncService {
  constructor() {
    // Mock implementation
  }

  async syncPricing() {
    return { success: true, syncedRules: [] }
  }

  async updatePricingRules() {
    return { success: true, updatedRules: [] }
  }
}

export function createPricingSyncService() {
  return new PricingSyncService()
}