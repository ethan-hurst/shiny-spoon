import { describe, expect, it } from '@jest/globals'
import {
  validateStockAvailability,
  calculateAvailableInventory,
  checkReorderPoint,
  allocateInventory,
  splitAllocation,
  allocateWithPriority,
  reserveInventory,
  cleanupExpiredReservations,
  shipReservedInventory,
  validateAdjustment,
  determineAdjustmentApproval,
  recordAdjustment,
  prioritizeCycleCounts,
  calculateCycleCountAccuracy,
  initiateTransfer,
  optimizeStockDistribution,
  calculateFIFOValue,
  analyzeInventoryAging,
  calculateSafetyStock,
  adjustSeasonalSafetyStock,
  detectDiscrepancy,
  applyConcurrentUpdates
} from '@/lib/inventory/inventory-behavior'

/**
 * Behavioral Unit Tests for Inventory Management
 * 
 * These tests define the expected business rules and behaviors for inventory operations.
 * They serve as executable specifications for the inventory system.
 */

describe('Inventory Management Behavior', () => {
  describe('Stock Level Management', () => {
    it('should never allow negative inventory unless explicitly configured', () => {
      const currentStock = 10
      const requestedQuantity = 15
      const allowNegative = false
      
      const result = validateStockAvailability(currentStock, requestedQuantity, allowNegative)
      
      expect(result.canFulfill).toBe(false)
      expect(result.available).toBe(10)
      expect(result.shortBy).toBe(5)
      expect(result.suggestion).toBe('Only 10 units available')
    })

    it('should track available vs physical inventory separately', () => {
      const inventory = {
        physical: 100,
        reserved: 30,
        damaged: 5,
        inTransit: 20
      }
      
      const availability = calculateAvailableInventory(inventory)
      
      expect(availability.total).toBe(100)
      expect(availability.available).toBe(65) // 100 - 30 - 5
      expect(availability.pending).toBe(20)
      expect(availability.sellable).toBe(85) // 65 + 20
    })

    it('should automatically trigger reorder when hitting reorder point', () => {
      const item = {
        sku: 'WIDGET-001',
        currentStock: 45,
        reorderPoint: 50,
        reorderQuantity: 200,
        leadTimeDays: 14
      }
      
      const reorderTrigger = checkReorderPoint(item)
      
      expect(reorderTrigger.shouldReorder).toBe(true)
      expect(reorderTrigger.suggestedQuantity).toBe(200)
      expect(reorderTrigger.expectedDelivery).toBeDefined()
      expect(reorderTrigger.urgency).toBe('normal')
    })
  })

  describe('Warehouse Allocation', () => {
    it('should allocate from nearest warehouse by default', () => {
      const orderLocation = { lat: 34.0522, lng: -118.2437 } // LA
      const warehouses = [
        { id: 'wh1', location: { lat: 37.7749, lng: -122.4194 }, stock: 50 }, // SF
        { id: 'wh2', location: { lat: 34.0522, lng: -118.2437 }, stock: 30 }, // LA
        { id: 'wh3', location: { lat: 40.7128, lng: -74.0060 }, stock: 100 }  // NY
      ]
      const quantity = 25
      
      const allocation = allocateInventory(orderLocation, warehouses, quantity)
      
      expect(allocation.warehouseId).toBe('wh2') // LA warehouse
      expect(allocation.distance).toBe(0)
    })

    it('should split orders across warehouses when necessary', () => {
      const warehouses = [
        { id: 'wh1', available: 30 },
        { id: 'wh2', available: 25 },
        { id: 'wh3', available: 40 }
      ]
      const requiredQuantity = 70
      
      const allocation = splitAllocation(warehouses, requiredQuantity)
      
      expect(allocation.splits).toHaveLength(2)
      expect(allocation.splits[0]).toEqual({ warehouseId: 'wh3', quantity: 40 })
      expect(allocation.splits[1]).toEqual({ warehouseId: 'wh1', quantity: 30 })
      expect(allocation.fullyAllocated).toBe(true)
    })

    it('should respect warehouse priority settings', () => {
      const warehouses = [
        { id: 'wh1', stock: 100, priority: 3 },
        { id: 'wh2', stock: 100, priority: 1 },
        { id: 'wh3', stock: 100, priority: 2 }
      ]
      const quantity = 50
      
      const allocation = allocateWithPriority(warehouses, quantity)
      
      expect(allocation.warehouseId).toBe('wh2') // Highest priority (1)
    })
  })

  describe('Inventory Reservations', () => {
    it('should reserve inventory for confirmed orders', () => {
      const inventory = {
        productId: 'prod-123',
        warehouseId: 'wh-1',
        available: 100,
        reserved: 20
      }
      const orderQuantity = 30
      
      const reservation = reserveInventory(inventory, orderQuantity)
      
      expect(reservation.success).toBe(true)
      expect(reservation.reservationId).toBeDefined()
      expect(reservation.expiresAt).toBeDefined()
      expect(reservation.newAvailable).toBe(70)
      expect(reservation.newReserved).toBe(50)
    })

    it('should auto-release expired reservations', () => {
      const reservations = [
        { id: 'res1', quantity: 10, expiresAt: new Date(Date.now() - 3600000) }, // 1 hour ago
        { id: 'res2', quantity: 15, expiresAt: new Date(Date.now() + 3600000) }, // 1 hour future
        { id: 'res3', quantity: 5, expiresAt: new Date(Date.now() - 1000) }      // 1 second ago
      ]
      const currentReserved = 30
      
      const cleanup = cleanupExpiredReservations(reservations, currentReserved)
      
      expect(cleanup.releasedQuantity).toBe(15) // res1 + res3
      expect(cleanup.activeReservations).toHaveLength(1)
      expect(cleanup.newReservedTotal).toBe(15)
    })

    it('should convert reservations to allocated on shipment', () => {
      const reservation = {
        id: 'res-123',
        orderId: 'order-456',
        quantity: 25,
        status: 'reserved'
      }
      
      const shipment = shipReservedInventory(reservation)
      
      expect(shipment.status).toBe('allocated')
      expect(shipment.shippedAt).toBeDefined()
      expect(shipment.inventoryDeducted).toBe(true)
    })
  })

  describe('Stock Adjustments', () => {
    it('should require reason codes for all adjustments', () => {
      const adjustment = {
        productId: 'prod-123',
        quantity: -10,
        reason: null
      }
      
      const validation = validateAdjustment(adjustment)
      
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Reason code is required')
    })

    it('should enforce adjustment approval thresholds', () => {
      const adjustment = {
        productId: 'prod-123',
        currentValue: 10000,
        adjustmentValue: -2500, // 25% write-off
        reason: 'damaged'
      }
      const thresholds = {
        autoApprove: 500,
        singleApproval: 2000,
        multiApproval: 5000
      }
      
      const approval = determineAdjustmentApproval(adjustment, thresholds)
      
      expect(approval.required).toBe(true)
      expect(approval.level).toBe('single')
      expect(approval.reason).toBe('Adjustment value exceeds auto-approval threshold')
    })

    it('should maintain adjustment history with full context', () => {
      const adjustment = {
        productId: 'prod-123',
        warehouseId: 'wh-1',
        previousQuantity: 100,
        newQuantity: 85,
        reason: 'cycle_count',
        notes: 'Monthly inventory count',
        performedBy: 'user-456'
      }
      
      const history = recordAdjustment(adjustment)
      
      expect(history.id).toBeDefined()
      expect(history.timestamp).toBeDefined()
      expect(history.delta).toBe(-15)
      expect(history.snapshot).toEqual({
        before: { quantity: 100 },
        after: { quantity: 85 }
      })
      expect(history.reversible).toBe(true)
    })
  })

  describe('Cycle Counting', () => {
    it('should prioritize high-value items for cycle counts', () => {
      const items = [
        { sku: 'A', value: 1000, lastCounted: 30 }, // days ago
        { sku: 'B', value: 5000, lastCounted: 60 },
        { sku: 'C', value: 100, lastCounted: 90 },
        { sku: 'D', value: 10000, lastCounted: 15 }
      ]
      const rules = {
        highValueThreshold: 5000,
        highValueFrequency: 30, // days
        normalFrequency: 90
      }
      
      const priorities = prioritizeCycleCounts(items, rules)
      
      expect(priorities[0].sku).toBe('B') // High value, overdue
      expect(priorities[1].sku).toBe('C') // Low value but very overdue
      expect(priorities[2].sku).toBe('A') // Normal schedule
      expect(priorities[3].sku).toBe('D') // Recently counted
    })

    it('should calculate accuracy metrics from cycle counts', () => {
      const counts = [
        { expected: 100, actual: 98 },
        { expected: 50, actual: 52 },
        { expected: 200, actual: 195 },
        { expected: 75, actual: 75 }
      ]
      
      const metrics = calculateCycleCountAccuracy(counts)
      
      expect(metrics.overallAccuracy).toBeCloseTo(98.35, 2) // percentage
      expect(metrics.perfectCounts).toBe(1)
      expect(metrics.averageVariance).toBeCloseTo(2.25)
      expect(metrics.withinTolerance).toBe(3) // Assuming 3% tolerance
    })
  })

  describe('Multi-location Inventory', () => {
    it('should track inventory movements between locations', () => {
      const transfer = {
        fromWarehouse: 'wh-1',
        toWarehouse: 'wh-2',
        productId: 'prod-123',
        quantity: 50,
        reason: 'stock_balancing'
      }
      
      const movement = initiateTransfer(transfer)
      
      expect(movement.status).toBe('in_transit')
      expect(movement.estimatedArrival).toBeDefined()
      expect(movement.trackingNumber).toBeDefined()
      expect(movement.affects).toEqual({
        'wh-1': { available: -50, inTransit: 0 },
        'wh-2': { available: 0, inTransit: +50 }
      })
    })

    it('should optimize stock distribution across network', () => {
      const network = [
        { warehouseId: 'wh-1', stock: 200, demandForecast: 50 },
        { warehouseId: 'wh-2', stock: 20, demandForecast: 80 },
        { warehouseId: 'wh-3', stock: 150, demandForecast: 60 }
      ]
      const totalDemand = 190
      const safetyStock = 20
      
      const optimization = optimizeStockDistribution(network, totalDemand, safetyStock)
      
      expect(optimization.transfers).toContainEqual({
        from: 'wh-1',
        to: 'wh-2',
        quantity: 60,
        reason: 'Demand balancing'
      })
      expect(optimization.balanced).toBe(true)
    })
  })

  describe('Inventory Valuation', () => {
    it('should calculate inventory value using FIFO method', () => {
      const purchases = [
        { date: '2024-01-01', quantity: 100, unitCost: 10 },
        { date: '2024-02-01', quantity: 50, unitCost: 12 },
        { date: '2024-03-01', quantity: 75, unitCost: 11 }
      ]
      const currentQuantity = 150
      
      const valuation = calculateFIFOValue(purchases, currentQuantity)
      
      // First 100 @ $10 = $1000
      // Next 50 @ $12 = $600
      expect(valuation.totalValue).toBe(1600)
      expect(valuation.averageCost).toBeCloseTo(10.67, 2)
      expect(valuation.layers).toHaveLength(2)
    })

    it('should track inventory aging for perishable items', () => {
      const inventory = [
        { batch: 'B001', quantity: 50, receivedDate: '2024-01-01', expiryDate: '2024-06-01' },
        { batch: 'B002', quantity: 30, receivedDate: '2024-02-15', expiryDate: '2024-07-15' },
        { batch: 'B003', quantity: 40, receivedDate: '2024-03-01', expiryDate: '2024-05-01' }
      ]
      const currentDate = new Date('2024-04-15')
      
      const aging = analyzeInventoryAging(inventory, currentDate)
      
      expect(aging.expired).toBe(0)
      expect(aging.expiringWithin30Days).toBe(40) // B003
      expect(aging.expiringWithin60Days).toBe(90) // B003 + B001
      expect(aging.oldestBatch).toBe('B001')
      expect(aging.recommendedAction).toContain('Prioritize selling B003')
    })
  })

  describe('Safety Stock Management', () => {
    it('should calculate safety stock based on demand variability', () => {
      const demandHistory = [80, 100, 90, 120, 85, 110, 95, 105] // Daily demand
      const leadTimeDays = 7
      const serviceLevel = 0.95 // 95% service level
      
      const safetyStock = calculateSafetyStock(demandHistory, leadTimeDays, serviceLevel)
      
      expect(safetyStock.quantity).toBeCloseTo(41.3, 1) // Based on std dev and z-score
      expect(safetyStock.averageDemand).toBe(98.125)
      expect(safetyStock.standardDeviation).toBeCloseTo(14.36, 2)
    })

    it('should adjust safety stock for seasonal patterns', () => {
      const product = {
        sku: 'SEASONAL-001',
        baseSafetyStock: 100,
        seasonalProfile: {
          jan: 0.7, feb: 0.7, mar: 0.8, apr: 1.0,
          may: 1.2, jun: 1.5, jul: 1.8, aug: 1.8,
          sep: 1.4, oct: 1.1, nov: 0.9, dec: 0.8
        }
      }
      const currentMonth = 'jul'
      
      const adjustedStock = adjustSeasonalSafetyStock(product, currentMonth)
      
      expect(adjustedStock).toBe(180) // 100 * 1.8
    })
  })

  describe('Inventory Synchronization', () => {
    it('should detect and flag inventory discrepancies', () => {
      const systemInventory = { quantity: 100, lastUpdated: '2024-04-15T10:00:00Z' }
      const externalInventory = { quantity: 95, lastUpdated: '2024-04-15T10:05:00Z' }
      const tolerance = 2 // 2% tolerance
      
      const discrepancy = detectDiscrepancy(systemInventory, externalInventory, tolerance)
      
      expect(discrepancy.hasDiscrepancy).toBe(true)
      expect(discrepancy.variance).toBe(5)
      expect(discrepancy.variancePercent).toBe(5)
      expect(discrepancy.exceedsTolerance).toBe(true)
      expect(discrepancy.suggestedAction).toBe('Investigate and reconcile')
    })

    it('should handle concurrent inventory updates safely', () => {
      const updates = [
        { id: 'tx1', product: 'A', quantity: -10, timestamp: 1000 },
        { id: 'tx2', product: 'A', quantity: -15, timestamp: 1001 },
        { id: 'tx3', product: 'A', quantity: +20, timestamp: 999 }
      ]
      const initialStock = 50
      
      const result = applyConcurrentUpdates(initialStock, updates)
      
      expect(result.finalQuantity).toBe(45) // 50 + 20 - 10 - 15
      expect(result.appliedOrder).toEqual(['tx3', 'tx1', 'tx2'])
      expect(result.conflicts).toHaveLength(0)
    })
  })
})