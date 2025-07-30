// Mock inventory sync service for testing
export class InventorySyncService {
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

  async syncInventory() {
    return { success: true, syncedItems: [] }
  }

  async resolveConflicts() {
    return { resolved: true, conflicts: [] }
  }
}

export function createInventorySyncService() {
  return new InventorySyncService()
}