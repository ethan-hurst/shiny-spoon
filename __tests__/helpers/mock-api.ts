interface MockAPI {
  mockInventoryResponse: (data: any[]) => void
  mockPricingResponse: (data: any[]) => void
  mockImplementation: (impl: () => any) => void
  reset: () => void
}

class MockExternalAPI implements MockAPI {
  private inventoryData: any[] = []
  private pricingData: any[] = []
  private customImplementation: (() => any) | null = null

  mockInventoryResponse(data: any[]): void {
    this.inventoryData = data
  }

  mockPricingResponse(data: any[]): void {
    this.pricingData = data
  }

  mockImplementation(impl: () => any): void {
    this.customImplementation = impl
  }

  reset(): void {
    this.inventoryData = []
    this.pricingData = []
    this.customImplementation = null
  }

  getInventory(): any[] {
    if (this.customImplementation) {
      return this.customImplementation()
    }
    return this.inventoryData
  }

  getPricing(): any[] {
    if (this.customImplementation) {
      return this.customImplementation()
    }
    return this.pricingData
  }
}

export const mockExternalAPI = new MockExternalAPI()

test('placeholder', () => { expect(true).toBe(true) })