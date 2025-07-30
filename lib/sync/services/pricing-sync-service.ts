// Mock pricing sync service for testing
export class PricingSyncService {
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