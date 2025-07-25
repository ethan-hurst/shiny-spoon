import { createClient } from '@/lib/supabase/client'

export interface InventoryData {
  totalQuantity: number
  availableQuantity: number
  reservedQuantity: number
  warehouseId?: string
}

interface InventoryItem {
  quantity: number | null
  reserved_quantity: number | null
  warehouse_id: string
}

/**
 * Get inventory data for a product across all warehouses
 */
export async function getProductInventory(
  productId: string,
  organizationId: string,
  warehouseId?: string
): Promise<InventoryData | null> {
  const supabase = createClient()

  try {
    let query = supabase
      .from('inventory')
      .select('quantity, reserved_quantity, warehouse_id')
      .eq('product_id', productId)
      .eq('organization_id', organizationId)

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch inventory:', error)
      return null
    }

    if (!data || data.length === 0) {
      return null
    }

    // Aggregate inventory across warehouses
    const aggregated = data.reduce(
      (acc: { totalQuantity: number; reservedQuantity: number }, item: InventoryItem) => {
        acc.totalQuantity += item.quantity || 0
        acc.reservedQuantity += item.reserved_quantity || 0
        return acc
      },
      { totalQuantity: 0, reservedQuantity: 0 }
    )

    return {
      totalQuantity: aggregated.totalQuantity,
      availableQuantity: aggregated.totalQuantity - aggregated.reservedQuantity,
      reservedQuantity: aggregated.reservedQuantity,
      warehouseId:
        warehouseId || (data.length === 1 ? data[0].warehouse_id : undefined),
    }
  } catch (error) {
    console.error('Inventory fetch error:', error)
    return null
  }
}

/**
 * Get inventory data with caching
 */
const inventoryCache = new Map<
  string,
  { data: InventoryData; expires: number }
>()
const INVENTORY_CACHE_TTL = 60000 // 1 minute

export async function getCachedInventory(
  productId: string,
  organizationId: string,
  warehouseId?: string
): Promise<InventoryData | null> {
  const cacheKey = `${productId}:${organizationId}:${warehouseId || 'all'}`

  // Check cache
  const cached = inventoryCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  // Fetch fresh data
  const data = await getProductInventory(productId, organizationId, warehouseId)

  if (data) {
    inventoryCache.set(cacheKey, {
      data,
      expires: Date.now() + INVENTORY_CACHE_TTL,
    })
  }

  return data
}

/**
 * Clear inventory cache
 */
export function clearInventoryCache(productId?: string): void {
  if (productId) {
    // Clear specific product
    for (const key of inventoryCache.keys()) {
      if (key.startsWith(productId)) {
        inventoryCache.delete(key)
      }
    }
  } else {
    // Clear all
    inventoryCache.clear()
  }
}

/**
 * Calculate dynamic price based on inventory levels
 */
export function calculateInventoryBasedPrice(
  basePrice: number,
  inventoryData: InventoryData,
  rules: {
    criticalLevelMultiplier?: number // Price multiplier when inventory is critical
    lowLevelMultiplier?: number // Price multiplier when inventory is low
    excessLevelDiscount?: number // Discount percentage when inventory is excess
  } = {}
): number {
  const {
    criticalLevelMultiplier = 1.2, // 20% increase
    lowLevelMultiplier = 1.1, // 10% increase
    excessLevelDiscount = 10, // 10% discount
  } = rules

  if (inventoryData.totalQuantity <= 0) {
    return basePrice // No valid inventory data
  }

  const inventoryPercent =
    (inventoryData.availableQuantity / inventoryData.totalQuantity) * 100

  if (inventoryPercent < 10) {
    // Critical level
    return basePrice * criticalLevelMultiplier
  } else if (inventoryPercent < 25) {
    // Low level
    return basePrice * lowLevelMultiplier
  } else if (inventoryPercent > 75) {
    // Excess level
    return basePrice * (1 - excessLevelDiscount / 100)
  }

  return basePrice
}

/**
 * Check if requested quantity is available
 */
export function isQuantityAvailable(
  requestedQuantity: number,
  inventoryData: InventoryData | null
): boolean {
  if (!inventoryData) {
    return false // Conservative approach - treat missing data as unavailable
  }

  return requestedQuantity <= inventoryData.availableQuantity
}

/**
 * Get inventory-based pricing rule conditions
 */
export function getInventoryConditions(
  inventoryData: InventoryData
): Record<string, any> {
  if (inventoryData.totalQuantity <= 0) {
    return {
      inventory_level: 'unknown',
      inventory_percent: 0,
    }
  }

  const inventoryPercent =
    (inventoryData.availableQuantity / inventoryData.totalQuantity) * 100

  let level: string
  if (inventoryPercent < 10) {
    level = 'critical'
  } else if (inventoryPercent < 25) {
    level = 'low'
  } else if (inventoryPercent < 50) {
    level = 'medium'
  } else if (inventoryPercent < 75) {
    level = 'high'
  } else {
    level = 'excess'
  }

  return {
    inventory_level: level,
    available_quantity: inventoryData.availableQuantity,
    total_quantity: inventoryData.totalQuantity,
    inventory_percent: inventoryPercent,
  }
}
