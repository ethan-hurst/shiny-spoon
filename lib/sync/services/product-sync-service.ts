// Mock product sync service for testing
export class ProductSyncService {
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

  async syncProducts() {
    return { success: true, syncedProducts: [] }
  }

  async updateProductData() {
    return { success: true, updatedProducts: [] }
  }
}

export function createProductSyncService() {
  return new ProductSyncService()
}