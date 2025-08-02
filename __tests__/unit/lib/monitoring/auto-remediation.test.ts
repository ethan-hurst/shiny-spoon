import { AutoRemediationService } from '@/lib/monitoring/auto-remediation'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Discrepancy, RemediationAction } from '@/lib/monitoring/types'

// Mock dependencies
jest.mock('@/lib/supabase/admin')

// Mock setTimeout to control delays
jest.useFakeTimers()

describe('AutoRemediationService', () => {
  let autoRemediationService: AutoRemediationService
  let mockSupabase: ReturnType<typeof createMockSupabase>
  
  const mockDiscrepancy: Discrepancy = {
    id: 'discrepancy-123',
    accuracyCheckId: 'check-123',
    organizationId: 'org-123',
    entityType: 'inventory',
    entityId: 'inv-456',
    fieldName: 'quantity',
    sourceValue: 100,
    targetValue: 95,
    discrepancyType: 'mismatch',
    severity: 'high',
    confidenceScore: 0.95,
    status: 'open',
    detectedAt: new Date('2024-01-15T10:00:00Z'),
    metadata: {}
  }

  const mockIntegration = {
    id: 'integration-123',
    organization_id: 'org-123',
    platform: 'netsuite',
    status: 'active',
    config: {}
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    
    mockSupabase = createMockSupabase()
    ;(createAdminClient as jest.Mock).mockReturnValue(mockSupabase)
    
    autoRemediationService = new AutoRemediationService()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('attemptRemediation', () => {
    it('should execute remediation successfully', async () => {
      const mockLogEntry = { id: 'log-123' }
      const mockSyncJob = { id: 'sync-123' }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'remediation_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockLogEntry,
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        if (table === 'accuracy_checks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { integration_id: 'integration-123', organization_id: 'org-123' },
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'integrations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockIntegration,
                    error: null
                  })
                })
              })
            })
          } as any
        }
        if (table === 'sync_jobs') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockSyncJob,
                  error: null
                })
              })
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { status: 'completed' },
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'discrepancies') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        return {} as any
      })

      const staleDiscrepancy = { ...mockDiscrepancy, discrepancyType: 'stale' as const }
      const result = await autoRemediationService.attemptRemediation(staleDiscrepancy)

      // Use advanceTimersByTime instead of runAllTimers
      jest.advanceTimersByTime(5000)

      expect(result.success).toBe(true)
      expect(result.action).toBe('sync_retry')
    }, 10000) // Add timeout

    it('should handle no remediation action available', async () => {
      const unsupportedDiscrepancy = {
        ...mockDiscrepancy,
        discrepancyType: 'duplicate' as const,
        entityType: 'unknown'
      }

      const result = await autoRemediationService.attemptRemediation(unsupportedDiscrepancy)

      expect(result.success).toBe(false)
      expect(result.action).toBe('none')
      expect(result.error).toContain('No remediation action available')
    })

    it('should handle log creation failure', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'remediation_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Insert failed' }
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const result = await autoRemediationService.attemptRemediation(mockDiscrepancy)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create remediation log')
    })

    it('should handle remediation execution failure', async () => {
      const mockLogEntry = { id: 'log-123' }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'remediation_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockLogEntry,
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        if (table === 'accuracy_checks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const result = await autoRemediationService.attemptRemediation(mockDiscrepancy)

      expect(result.success).toBe(false)
    })

    it('should handle exceptions gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const result = await autoRemediationService.attemptRemediation(mockDiscrepancy)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unexpected error')
    })
  })

  describe('determineRemediationAction', () => {
    it('should determine sync_retry for stale inventory', () => {
      const staleInventory = {
        ...mockDiscrepancy,
        discrepancyType: 'stale' as const,
        entityType: 'inventory'
      }

      const action = (autoRemediationService as any).determineRemediationAction(staleInventory)

      expect(action).toBeDefined()
      expect(action.actionType).toBe('sync_retry')
      expect(action.priority).toBe('high')
    })

    it('should determine sync_retry for missing products', () => {
      const missingProduct = {
        ...mockDiscrepancy,
        discrepancyType: 'missing' as const,
        entityType: 'product'
      }

      const action = (autoRemediationService as any).determineRemediationAction(missingProduct)

      expect(action).toBeDefined()
      expect(action.actionType).toBe('sync_retry')
      expect(action.actionConfig.operation).toBe('create')
    })

    it('should determine value_update for pricing mismatch', () => {
      const pricingMismatch = {
        ...mockDiscrepancy,
        discrepancyType: 'mismatch' as const,
        entityType: 'pricing',
        fieldName: 'price',
        sourceValue: 99.99
      }

      const action = (autoRemediationService as any).determineRemediationAction(pricingMismatch)

      expect(action).toBeDefined()
      expect(action.actionType).toBe('value_update')
      expect(action.actionConfig.newValue).toBe(99.99)
      expect(action.priority).toBe('high')
    })

    it('should return null for unsupported discrepancy types', () => {
      const unsupported = {
        ...mockDiscrepancy,
        discrepancyType: 'duplicate' as const
      }

      const action = (autoRemediationService as any).determineRemediationAction(unsupported)

      expect(action).toBeNull()
    })
  })

  describe('executeSyncRetry', () => {
    const mockAction: RemediationAction = {
      discrepancyId: 'discrepancy-123',
      actionType: 'sync_retry',
      actionConfig: {
        entityType: 'inventory',
        entityId: 'inv-456',
        forceRefresh: true
      },
      priority: 'high',
      estimatedImpact: 'Refresh inventory data'
    }

    it('should execute sync retry successfully', async () => {
      const mockSyncJob = { id: 'sync-123' }
      
      setupMocksForSyncRetry(mockSupabase, mockSyncJob, 'completed')

      const result = await (autoRemediationService as any).executeSyncRetry(
        mockAction,
        mockDiscrepancy
      )

      // Advance timer for delay
      jest.advanceTimersByTime(100)
      // Advance timer for polling
      jest.advanceTimersByTime(1000)

      expect(result.success).toBe(true)
      expect(result.result.sync_job_id).toBe('sync-123')
    })

    it('should handle sync job creation failure', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'accuracy_checks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { integration_id: 'integration-123', organization_id: 'org-123' },
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'integrations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockIntegration,
                    error: null
                  })
                })
              })
            })
          } as any
        }
        if (table === 'sync_jobs') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Insert failed' }
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const result = await (autoRemediationService as any).executeSyncRetry(
        mockAction,
        mockDiscrepancy
      )

      jest.advanceTimersByTime(100)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create sync job')
    })

    it('should handle sync job timeout', async () => {
      const mockSyncJob = { id: 'sync-123' }
      
      setupMocksForSyncRetry(mockSupabase, mockSyncJob, 'running')

      const staleDiscrepancy = { ...mockDiscrepancy, discrepancyType: 'stale' as const }
      const result = await autoRemediationService.attemptRemediation(staleDiscrepancy)

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(30000) // 30 seconds timeout

      expect(result.success).toBe(false)
      expect(result.action).toBe('sync_retry')
      expect(result.error).toContain('timeout')
    }, 15000) // Add timeout
  })

  describe('executeValueUpdate', () => {
    const mockAction: RemediationAction = {
      discrepancyId: 'discrepancy-123',
      actionType: 'value_update',
      actionConfig: {
        entityType: 'inventory',
        entityId: 'inv-456',
        field: 'quantity',
        newValue: 100
      },
      priority: 'medium',
      estimatedImpact: 'Update inventory quantity'
    }

    it('should execute value update successfully', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'inventory') {
          let currentValue = 95
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { quantity: currentValue },
                  error: null
                })
              })
            }),
            update: jest.fn().mockImplementation(() => {
              currentValue = 100 // Simulate successful update
              return {
                eq: jest.fn().mockResolvedValue({ data: null, error: null })
              }
            })
          } as any
        }
        return {} as any
      })

      const result = await (autoRemediationService as any).executeValueUpdate(
        mockAction,
        mockDiscrepancy
      )

      jest.advanceTimersByTime(100)

      expect(result.success).toBe(true)
      expect(result.result.previous_value).toBe(95)
      expect(result.result.new_value).toBe(100)
    })

    it('should fail unsafe updates', async () => {
      const unsafeAction = {
        ...mockAction,
        actionConfig: {
          ...mockAction.actionConfig,
          newValue: -10 // Negative inventory
        }
      }

      const result = await (autoRemediationService as any).executeValueUpdate(
        unsafeAction,
        mockDiscrepancy
      )

      jest.advanceTimersByTime(100)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Update failed safety validation')
    })

    it('should handle update verification failure', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'inventory') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn()
                  .mockResolvedValueOnce({ data: { quantity: 95 }, error: null })
                  .mockResolvedValueOnce({ data: { quantity: 95 }, error: null }) // Value unchanged
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        return {} as any
      })

      const result = await (autoRemediationService as any).executeValueUpdate(
        mockAction,
        mockDiscrepancy
      )

      jest.advanceTimersByTime(100)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Update verification failed')
    })
  })

  describe('executeCacheClear', () => {
    const mockAction: RemediationAction = {
      discrepancyId: 'discrepancy-123',
      actionType: 'cache_clear',
      actionConfig: {
        entityType: 'inventory',
        entityId: 'inv-456'
      },
      priority: 'low',
      estimatedImpact: 'Clear cached data'
    }

    it('should clear cache successfully', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      } as any)

      const result = await (autoRemediationService as any).executeCacheClear(
        mockAction,
        mockDiscrepancy
      )

      jest.advanceTimersByTime(100)

      expect(result.success).toBe(true)
      expect(result.result.keys_cleared).toContain('inventory:inv-456')
    })
  })

  describe('Safety validation', () => {
    it('should validate inventory updates', () => {
      const testCases = [
        { field: 'quantity', value: 100, expected: true },
        { field: 'quantity', value: -1, expected: false },
        { field: 'quantity', value: 1000001, expected: false },
        { field: 'quantity', value: 'not a number', expected: false },
        { field: 'reserved', value: 50, expected: true },
        { field: 'reserved', value: -10, expected: false }
      ]

      for (const { field, value, expected } of testCases) {
        const result = (autoRemediationService as any).isUpdateSafe('inventory', field, value)
        expect(result).toBe(expected)
      }
    })

    it('should validate pricing updates', () => {
      const testCases = [
        { field: 'price', value: 99.99, expected: true },
        { field: 'price', value: 0, expected: false },
        { field: 'price', value: -10, expected: false },
        { field: 'price', value: 1000001, expected: false },
        { field: 'cost', value: 50, expected: true },
        { field: 'cost', value: -1, expected: false }
      ]

      for (const { field, value, expected } of testCases) {
        const result = (autoRemediationService as any).isUpdateSafe('pricing', field, value)
        expect(result).toBe(expected)
      }
    })

    it('should validate product updates', () => {
      const testCases = [
        { field: 'name', value: 'Valid Product Name', expected: true },
        { field: 'name', value: '', expected: false },
        { field: 'name', value: 'A'.repeat(256), expected: false },
        { field: 'description', value: 'Valid description', expected: true },
        { field: 'description', value: 'A'.repeat(5001), expected: false }
      ]

      for (const { field, value, expected } of testCases) {
        const result = (autoRemediationService as any).isUpdateSafe('product', field, value)
        expect(result).toBe(expected)
      }
    })
  })

  describe('batchRemediate', () => {
    it('should process batch successfully', async () => {
      const discrepancyIds = ['disc-1', 'disc-2', 'disc-3']
      const mockDiscrepancies = discrepancyIds.map(id => ({
        ...mockDiscrepancy,
        id,
        discrepancyType: 'stale' as const
      }))

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discrepancies') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: mockDiscrepancies,
                error: null
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        if (table === 'remediation_log') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'log-123' },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        // Mock other tables for successful remediation
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { integration_id: 'integration-123', organization_id: 'org-123' },
                error: null
              })
            })
          })
        } as any
      })

      const result = await autoRemediationService.batchRemediate(discrepancyIds)

      expect(result.total).toBe(3)
      expect(result.success).toBeGreaterThanOrEqual(0)
      expect(result.failed).toBeGreaterThanOrEqual(0)
      expect(result.success + result.failed).toBe(3)
    })

    it('should respect batch size limit', async () => {
      const discrepancyIds = Array(150).fill(null).map((_, i) => `disc-${i}`)
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'discrepancies') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockImplementation((field: string, ids: string[]) => {
                // Should only query first 100 IDs
                expect(ids.length).toBeLessThanOrEqual(100)
                return {
                  data: [],
                  error: null
                }
              })
            })
          } as any
        }
        return {} as any
      })

      const result = await autoRemediationService.batchRemediate(discrepancyIds)

      expect(result.total).toBe(100) // MAX_CHANGES_PER_RUN
    })

    it('should handle missing discrepancies', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      } as any)

      const result = await autoRemediationService.batchRemediate(['disc-1', 'disc-2'])

      expect(result.total).toBe(2)
      expect(result.success).toBe(0)
      expect(result.failed).toBe(2)
    })
  })

  describe('Helper methods', () => {
    it('should match values with numeric epsilon', () => {
      expect((autoRemediationService as any).valuesMatch(10.0, 10.005)).toBe(true)
      expect((autoRemediationService as any).valuesMatch(10.0, 10.02)).toBe(false)
      expect((autoRemediationService as any).valuesMatch('test', 'test')).toBe(true)
      expect((autoRemediationService as any).valuesMatch('test', 'TEST')).toBe(false)
    })

    it('should generate correct cache keys', () => {
      const keys = (autoRemediationService as any).getCacheKeysForEntity('inventory', 'inv-123')
      
      expect(keys).toContain('inventory:inv-123')
      expect(keys).toContain('inventory:list:*')
      expect(keys).toContain('accuracy:inventory:*')
    })

    it('should handle organization mismatch in getIntegrationForDiscrepancy', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'accuracy_checks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { integration_id: 'integration-123', organization_id: 'different-org' },
                  error: null
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const integration = await (autoRemediationService as any).getIntegrationForDiscrepancy(
        mockDiscrepancy
      )

      expect(integration).toBeNull()
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn(),
    rpc: jest.fn()
  }
}

// Helper to setup mocks for sync retry tests
function setupMocksForSyncRetry(mockSupabase: any, syncJob: any, finalStatus: string) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'accuracy_checks') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { integration_id: 'integration-123', organization_id: 'org-123' },
              error: null
            })
          })
        })
      } as any
    }
    if (table === 'integrations') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'integration-123', organization_id: 'org-123' },
                error: null
              })
            })
          })
        })
      } as any
    }
    if (table === 'sync_jobs') {
      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: syncJob,
              error: null
            })
          })
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { status: finalStatus },
              error: null
            })
          })
        })
      } as any
    }
    return {} as any
  })
}