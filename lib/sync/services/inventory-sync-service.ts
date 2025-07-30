// Mock inventory sync service for testing
export class InventorySyncService {
  constructor() {
    // Mock implementation
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