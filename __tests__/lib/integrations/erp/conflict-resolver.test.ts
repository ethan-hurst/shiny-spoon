import { ConflictResolver, ConflictRule } from '@/lib/integrations/erp/conflict-resolver'
import { DataConflict, ConflictSource } from '@/lib/integrations/erp/types'

describe('ConflictResolver', () => {
  let resolver: ConflictResolver

  beforeEach(() => {
    resolver = new ConflictResolver()
  })

  describe('default strategies', () => {
    it('should resolve update conflicts with last write wins', async () => {
      const conflict: DataConflict = {
        id: 'conflict-1',
        type: 'update_conflict',
        entity: 'products',
        entityId: 'product-123',
        sources: [
          {
            erp: 'SAP',
            data: { id: 'product-123', name: 'Product A', price: 100 },
            timestamp: new Date('2024-01-01'),
          },
          {
            erp: 'NETSUITE',
            data: { id: 'product-123', name: 'Product B', price: 110 },
            timestamp: new Date('2024-01-02'),
          },
        ],
        detectedAt: new Date(),
        status: 'pending',
      }

      const resolution = await resolver.resolveConflict(conflict)

      expect(resolution.action).toBe('accept')
      expect(resolution.source?.erp).toBe('NETSUITE')
      expect(resolution.reason).toContain('most recent update')
    })

    it('should merge duplicate records', async () => {
      const conflict: DataConflict = {
        id: 'conflict-2',
        type: 'duplicate',
        entity: 'customers',
        entityId: 'customer-456',
        sources: [
          {
            erp: 'SAP',
            data: { id: 'customer-456', name: 'John Doe', email: 'john@example.com' },
            timestamp: new Date(),
          },
          {
            erp: 'DYNAMICS365',
            data: { id: 'customer-456', name: 'John Doe', phone: '+1234567890' },
            timestamp: new Date(),
          },
        ],
        detectedAt: new Date(),
        status: 'pending',
      }

      const resolution = await resolver.resolveConflict(conflict)

      expect(resolution.action).toBe('merge')
      expect(resolution.mergedData).toBeDefined()
      expect(resolution.reason).toContain('Merged')
    })

    it('should require manual review for missing references', async () => {
      const conflict: DataConflict = {
        id: 'conflict-3',
        type: 'missing_reference',
        entity: 'orders',
        entityId: 'order-789',
        sources: [
          {
            erp: 'SAP',
            data: { id: 'order-789', customerId: 'unknown-customer' },
            timestamp: new Date(),
          },
        ],
        detectedAt: new Date(),
        status: 'pending',
      }

      const resolution = await resolver.resolveConflict(conflict)

      expect(resolution.action).toBe('manual_review')
      expect(resolution.reason).toContain('manual')
    })
  })

  describe('custom rules', () => {
    it('should apply custom rules with higher priority', async () => {
      const rule: ConflictRule = {
        id: 'rule-1',
        name: 'SAP Product Master',
        entity: 'products',
        type: 'update_conflict',
        condition: (conflict) => conflict.sources.some(s => s.erp === 'SAP'),
        resolution: (conflict) => {
          const sapSource = conflict.sources.find(s => s.erp === 'SAP')!
          return {
            conflictId: conflict.id,
            action: 'accept',
            source: sapSource,
            reason: 'SAP is master for products',
          }
        },
        priority: 100,
      }

      resolver.registerRule(rule)

      const conflict: DataConflict = {
        id: 'conflict-4',
        type: 'update_conflict',
        entity: 'products',
        entityId: 'product-999',
        sources: [
          {
            erp: 'NETSUITE',
            data: { id: 'product-999', price: 200 },
            timestamp: new Date('2024-01-02'),
          },
          {
            erp: 'SAP',
            data: { id: 'product-999', price: 190 },
            timestamp: new Date('2024-01-01'),
          },
        ],
        detectedAt: new Date(),
        status: 'pending',
      }

      const resolution = await resolver.resolveConflict(conflict)

      expect(resolution.action).toBe('accept')
      expect(resolution.source?.erp).toBe('SAP')
      expect(resolution.reason).toContain('SAP')
    })

    it('should respect rule priority order', async () => {
      const lowPriorityRule: ConflictRule = {
        id: 'rule-low',
        name: 'Low Priority Rule',
        entity: 'products',
        type: 'update_conflict',
        condition: () => true,
        resolution: () => ({
          conflictId: 'test',
          action: 'manual_review',
          reason: 'Low priority rule',
        }),
        priority: 10,
      }

      const highPriorityRule: ConflictRule = {
        id: 'rule-high',
        name: 'High Priority Rule',
        entity: 'products',
        type: 'update_conflict',
        condition: () => true,
        resolution: () => ({
          conflictId: 'test',
          action: 'accept',
          reason: 'High priority rule',
        }),
        priority: 100,
      }

      resolver.registerRule(lowPriorityRule)
      resolver.registerRule(highPriorityRule)

      const conflict: DataConflict = {
        id: 'conflict-5',
        type: 'update_conflict',
        entity: 'products',
        entityId: 'test',
        sources: [],
        detectedAt: new Date(),
        status: 'pending',
      }

      const resolution = await resolver.resolveConflict(conflict)

      expect(resolution.reason).toContain('High priority rule')
    })
  })

  describe('resolveConflicts', () => {
    it('should resolve multiple conflicts', async () => {
      const conflicts: DataConflict[] = [
        {
          id: 'conflict-6',
          type: 'update_conflict',
          entity: 'products',
          entityId: 'p1',
          sources: [
            {
              erp: 'SAP',
              data: { id: 'p1' },
              timestamp: new Date(),
            },
          ],
          detectedAt: new Date(),
          status: 'pending',
        },
        {
          id: 'conflict-7',
          type: 'duplicate',
          entity: 'customers',
          entityId: 'c1',
          sources: [
            {
              erp: 'NETSUITE',
              data: { id: 'c1' },
              timestamp: new Date(),
            },
            {
              erp: 'DYNAMICS365',
              data: { id: 'c1' },
              timestamp: new Date(),
            },
          ],
          detectedAt: new Date(),
          status: 'pending',
        },
      ]

      const resolutions = await resolver.resolveConflicts(conflicts)

      expect(resolutions).toHaveLength(2)
      expect(resolutions[0].conflictId).toBe('conflict-6')
      expect(resolutions[1].conflictId).toBe('conflict-7')
    })

    it('should handle errors gracefully', async () => {
      const errorRule: ConflictRule = {
        id: 'error-rule',
        name: 'Error Rule',
        entity: 'products',
        type: 'update_conflict',
        condition: () => true,
        resolution: () => {
          throw new Error('Rule error')
        },
        priority: 100,
      }

      resolver.registerRule(errorRule)

      const conflict: DataConflict = {
        id: 'conflict-8',
        type: 'update_conflict',
        entity: 'products',
        entityId: 'error-product',
        sources: [],
        detectedAt: new Date(),
        status: 'pending',
      }

      const resolutions = await resolver.resolveConflicts([conflict])

      expect(resolutions).toHaveLength(1)
      expect(resolutions[0].action).toBe('manual_review')
      expect(resolutions[0].reason).toContain('Error during resolution')
    })
  })

  describe('default rules', () => {
    beforeEach(() => {
      resolver.createDefaultRules()
    })

    it('should use SAP as product master', async () => {
      const conflict: DataConflict = {
        id: 'conflict-9',
        type: 'update_conflict',
        entity: 'products',
        entityId: 'prod-master',
        sources: [
          {
            erp: 'NETSUITE',
            data: { id: 'prod-master', name: 'NetSuite Product' },
            timestamp: new Date('2024-01-02'),
          },
          {
            erp: 'SAP',
            data: { id: 'prod-master', name: 'SAP Product' },
            timestamp: new Date('2024-01-01'),
          },
        ],
        detectedAt: new Date(),
        status: 'pending',
      }

      const resolution = await resolver.resolveConflict(conflict)

      expect(resolution.source?.erp).toBe('SAP')
      expect(resolution.reason).toContain('SAP is designated as product master')
    })

    it('should use most recent inventory data', async () => {
      const conflict: DataConflict = {
        id: 'conflict-10',
        type: 'update_conflict',
        entity: 'inventory',
        entityId: 'inv-123',
        sources: [
          {
            erp: 'SAP',
            data: { id: 'inv-123', quantity: 100 },
            timestamp: new Date('2024-01-01'),
          },
          {
            erp: 'NETSUITE',
            data: { id: 'inv-123', quantity: 95 },
            timestamp: new Date('2024-01-02'),
          },
        ],
        detectedAt: new Date(),
        status: 'pending',
      }

      const resolution = await resolver.resolveConflict(conflict)

      expect(resolution.source?.erp).toBe('NETSUITE')
      expect(resolution.reason).toContain('Inventory requires real-time accuracy')
    })

    it('should merge customers with same email', async () => {
      const conflict: DataConflict = {
        id: 'conflict-11',
        type: 'duplicate',
        entity: 'customers',
        entityId: 'cust-dup',
        sources: [
          {
            erp: 'SAP',
            data: { id: 'cust-1', email: 'john@example.com', name: 'John Doe' },
            timestamp: new Date(),
          },
          {
            erp: 'NETSUITE',
            data: { id: 'cust-2', email: 'john@example.com', phone: '123-456-7890' },
            timestamp: new Date(),
          },
        ],
        detectedAt: new Date(),
        status: 'pending',
      }

      const resolution = await resolver.resolveConflict(conflict)

      expect(resolution.action).toBe('merge')
      expect(resolution.reason).toContain('Merged customers with same email')
    })
  })
})