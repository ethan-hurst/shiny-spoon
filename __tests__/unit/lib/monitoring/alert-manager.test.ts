import { AlertManager } from '@/lib/monitoring/alert-manager'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  AlertConfig,
  AlertRule,
  Alert,
  DiscrepancyResult,
} from '@/lib/monitoring/types'

// Mock dependencies
jest.mock('@/lib/supabase/admin')

describe('AlertManager', () => {
  let alertManager: AlertManager
  let mockSupabase: ReturnType<typeof createMockSupabase>
  
  const mockAlertRule: AlertRule = {
    id: 'rule-123',
    organizationId: 'org-123',
    name: 'Critical Accuracy Alert',
    description: 'Alert when accuracy drops below 90%',
    isActive: true,
    entityType: ['inventory', 'pricing'],
    severityThreshold: 'high',
    accuracyThreshold: 90,
    discrepancyCountThreshold: 50,
    checkFrequency: 3600, // 1 hour
    evaluationWindow: 7200, // 2 hours
    notificationChannels: ['email', 'in_app'],
    autoRemediate: true,
    escalationPolicy: {},
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    createdBy: 'user-123'
  }

  const mockAlert: Alert = {
    id: 'alert-123',
    alertRuleId: 'rule-123',
    organizationId: 'org-123',
    title: 'Data Accuracy Alert: Critical Accuracy Alert',
    message: 'Accuracy check detected issues',
    severity: 'high',
    triggeredBy: 'threshold',
    triggerValue: {
      accuracy_score: 85,
      discrepancy_count: 75
    },
    accuracyCheckId: 'check-123',
    status: 'active',
    notificationsSent: {},
    createdAt: new Date('2024-01-15T12:00:00Z')
  }

  const mockDiscrepancies: DiscrepancyResult[] = [
    {
      entityType: 'inventory',
      entityId: 'inv-123',
      fieldName: 'quantity',
      sourceValue: 100,
      targetValue: 95,
      discrepancyType: 'mismatch',
      severity: 'high',
      confidence: 0.95
    },
    {
      entityType: 'pricing',
      entityId: 'price-456',
      fieldName: 'price',
      sourceValue: 99.99,
      targetValue: null,
      discrepancyType: 'missing',
      severity: 'critical',
      confidence: 1.0
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = createMockSupabase()
    ;(createAdminClient as jest.Mock).mockReturnValue(mockSupabase)
    
    alertManager = new AlertManager()
  })

  describe('createAlert', () => {
    const mockConfig: AlertConfig = {
      ruleId: 'rule-123',
      checkId: 'check-123',
      triggerReason: 'Accuracy 85.00% is below threshold 90%',
      accuracyScore: 85,
      discrepancyCount: 75,
      metadata: {
        threshold_type: 'accuracy',
        threshold_value: 90,
        actual_value: 85
      }
    }

    it('should create alert successfully', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'alert_rules') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAlertRule,
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'alerts') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAlert,
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'notification_log') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          } as any
        }
        if (table === 'remediation_queue') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          } as any
        }
        return {} as any
      })

      const alertId = await alertManager.createAlert(mockConfig)

      expect(alertId).toBe('alert-123')
      expect(mockSupabase.from).toHaveBeenCalledWith('alert_rules')
      expect(mockSupabase.from).toHaveBeenCalledWith('alerts')
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_log')
      expect(mockSupabase.from).toHaveBeenCalledWith('remediation_queue')
    })

    it('should return null when alert rule not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any)

      const alertId = await alertManager.createAlert(mockConfig)

      expect(alertId).toBeNull()
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'alert_rules') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAlertRule,
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'alerts') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' }
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const alertId = await alertManager.createAlert(mockConfig)

      expect(alertId).toBeNull()
    })

    it('should handle exceptions gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const alertId = await alertManager.createAlert(mockConfig)

      expect(alertId).toBeNull()
    })

    it('should calculate severity correctly', async () => {
      const testCases = [
        { accuracyScore: 75, discrepancyCount: 150, expectedSeverity: 'critical' },
        { accuracyScore: 85, discrepancyCount: 75, expectedSeverity: 'high' },
        { accuracyScore: 92, discrepancyCount: 30, expectedSeverity: 'medium' },
        { accuracyScore: 96, discrepancyCount: 10, expectedSeverity: 'low' }
      ]

      for (const testCase of testCases) {
        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockAlert, id: `alert-${testCase.expectedSeverity}` },
              error: null
            })
          })
        })

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'alert_rules') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { ...mockAlertRule, severity_threshold: 'low' },
                    error: null
                  })
                })
              })
            } as any
          }
          if (table === 'alerts') {
            return { insert: mockInsert } as any
          }
          return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) } as any
        })

        await alertManager.createAlert({
          ...mockConfig,
          accuracyScore: testCase.accuracyScore,
          discrepancyCount: testCase.discrepancyCount
        })

        const insertCall = mockInsert.mock.calls[0][0]
        expect(insertCall.severity).toBe(testCase.expectedSeverity)
      }
    })

    it('should build alert message with metadata', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockAlert,
            error: null
          })
        })
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'alert_rules') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAlertRule,
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'alerts') {
          return { insert: mockInsert } as any
        }
        return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) } as any
      })

      await alertManager.createAlert({
        ...mockConfig,
        metadata: {
          affected_products: 25,
          sync_latency_ms: 1500,
          last_successful_sync: '2024-01-15T11:00:00Z'
        }
      })

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.message).toContain('Affected Products: 25')
      expect(insertCall.message).toContain('Sync Latency Ms: 1500')
      expect(insertCall.message).toContain('Last Successful Sync: 2024-01-15T11:00:00Z')
    })
  })

  describe('evaluateAlertRules', () => {
    const checkId = 'check-123'
    const accuracyScore = 85

    it('should evaluate and trigger alerts for matching rules', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'accuracy_checks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { organization_id: 'org-123' },
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'alert_rules') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [mockAlertRule],
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'alerts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [],
                      error: null
                    })
                  })
                })
              })
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAlert,
                  error: null
                })
              })
            })
          } as any
        }
        return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) } as any
      })

      const alertIds = await alertManager.evaluateAlertRules(checkId, accuracyScore, mockDiscrepancies)

      expect(alertIds).toHaveLength(1)
      expect(alertIds[0]).toBe('alert-123')
    })

    it('should skip inactive rules', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'accuracy_checks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { organization_id: 'org-123' },
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'alert_rules') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ ...mockAlertRule, isActive: false }],
                  error: null
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const alertIds = await alertManager.evaluateAlertRules(checkId, accuracyScore, mockDiscrepancies)

      expect(alertIds).toHaveLength(0)
    })

    it('should handle missing check gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any)

      const alertIds = await alertManager.evaluateAlertRules(checkId, accuracyScore, mockDiscrepancies)

      expect(alertIds).toHaveLength(0)
    })

    it('should handle errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database error')
      })

      const alertIds = await alertManager.evaluateAlertRules(checkId, accuracyScore, mockDiscrepancies)

      expect(alertIds).toHaveLength(0)
    })
  })

  describe('shouldTriggerAlert', () => {
    it('should trigger alert for accuracy threshold breach', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await (alertManager as any).shouldTriggerAlert(
        mockAlertRule,
        85, // Below 90% threshold
        mockDiscrepancies
      )

      expect(result.trigger).toBe(true)
      expect(result.reason).toContain('Accuracy 85.00% is below threshold 90%')
      expect(result.metadata.threshold_type).toBe('accuracy')
    })

    it('should trigger alert for discrepancy count threshold breach', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const manyDiscrepancies = Array(60).fill(mockDiscrepancies[0])

      const result = await (alertManager as any).shouldTriggerAlert(
        mockAlertRule,
        95, // Above accuracy threshold
        manyDiscrepancies
      )

      expect(result.trigger).toBe(true)
      expect(result.reason).toContain('60 discrepancies exceed threshold of 50')
      expect(result.metadata.threshold_type).toBe('count')
    })

    it('should trigger alert for severity threshold breach', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await (alertManager as any).shouldTriggerAlert(
        mockAlertRule,
        95, // Above accuracy threshold
        mockDiscrepancies // Contains high and critical severity
      )

      expect(result.trigger).toBe(true)
      expect(result.reason).toContain('discrepancies at or above high severity detected')
      expect(result.metadata.threshold_type).toBe('severity')
    })

    it('should suppress alerts within frequency limit', async () => {
      const recentAlert = {
        created_at: new Date(Date.now() - 1800 * 1000).toISOString() // 30 minutes ago
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [recentAlert],
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await (alertManager as any).shouldTriggerAlert(
        mockAlertRule,
        85, // Below threshold
        mockDiscrepancies
      )

      expect(result.trigger).toBe(false)
      expect(result.reason).toBe('Alert suppressed due to frequency limit')
    })

    it('should filter by entity type when specified', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const inventoryOnlyDiscrepancies = Array(60).fill({
        ...mockDiscrepancies[0],
        entityType: 'inventory'
      })

      const result = await (alertManager as any).shouldTriggerAlert(
        { ...mockAlertRule, entityType: ['inventory'] },
        95,
        inventoryOnlyDiscrepancies
      )

      expect(result.trigger).toBe(true)
      expect(result.metadata.monitored_entities).toEqual(['inventory'])
    })
  })

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert successfully', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      } as any)

      const result = await alertManager.acknowledgeAlert('alert-123', 'user-456')

      expect(result).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('alerts')
    })

    it('should return false on error', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Update failed' }
          })
        })
      } as any)

      const result = await alertManager.acknowledgeAlert('alert-123', 'user-456')

      expect(result).toBe(false)
    })
  })

  describe('resolveAlert', () => {
    it('should resolve alert successfully', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      } as any)

      const result = await alertManager.resolveAlert('alert-123')

      expect(result).toBe(true)
    })
  })

  describe('snoozeAlert', () => {
    it('should snooze alert with metadata', async () => {
      const snoozeUntil = new Date('2024-01-16T12:00:00Z')
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      })

      mockSupabase.from.mockReturnValue({
        update: mockUpdate
      } as any)

      const result = await alertManager.snoozeAlert('alert-123', snoozeUntil)

      expect(result).toBe(true)
      const updateCall = mockUpdate.mock.calls[0][0]
      expect(updateCall.status).toBe('snoozed')
      expect(updateCall.metadata.snoozed_until).toBe(snoozeUntil.toISOString())
    })
  })

  describe('getActiveAlerts', () => {
    it('should retrieve active and acknowledged alerts', async () => {
      const mockAlerts = [
        { ...mockAlert, status: 'active' },
        { ...mockAlert, id: 'alert-456', status: 'acknowledged' }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockAlerts,
                error: null
              })
            })
          })
        })
      } as any)

      const alerts = await alertManager.getActiveAlerts('org-123')

      expect(alerts).toHaveLength(2)
      expect(alerts[0].status).toBe('active')
      expect(alerts[1].status).toBe('acknowledged')
    })

    it('should return empty array on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Query failed' }
              })
            })
          })
        })
      } as any)

      const alerts = await alertManager.getActiveAlerts('org-123')

      expect(alerts).toEqual([])
    })
  })

  describe('getAlertHistory', () => {
    it('should return paginated alert history with total count', async () => {
      const mockAlerts = Array(5).fill(null).map((_, i) => ({
        ...mockAlert,
        id: `alert-${i}`,
        created_at: new Date(Date.now() - i * 3600000).toISOString()
      }))

      mockSupabase.from.mockImplementation((table: string) => {
        return {
          select: jest.fn().mockImplementation((columns: string, options?: any) => {
            if (options?.count === 'exact' && options?.head === true) {
              return {
                eq: jest.fn().mockResolvedValue({
                  count: 100,
                  error: null
                })
              }
            }
            return {
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  range: jest.fn().mockResolvedValue({
                    data: mockAlerts,
                    error: null
                  })
                })
              })
            }
          })
        } as any
      })

      const result = await alertManager.getAlertHistory('org-123', 5, 0)

      expect(result.alerts).toHaveLength(5)
      expect(result.total).toBe(100)
    })
  })

  describe('processSnoozeExpirations', () => {
    it('should reactivate expired snoozed alerts', async () => {
      const expiredAlerts = [
        {
          id: 'alert-123',
          metadata: {
            snoozed_until: new Date(Date.now() - 3600000).toISOString(),
            other_data: 'preserved'
          }
        },
        {
          id: 'alert-456',
          metadata: {
            snoozed_until: new Date(Date.now() - 7200000).toISOString()
          }
        }
      ]

      const mockUpdate = jest.fn().mockResolvedValue({
        data: null,
        error: null
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'alerts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lte: jest.fn().mockResolvedValue({
                  data: expiredAlerts,
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: mockUpdate
            })
          } as any
        }
        return {} as any
      })

      await alertManager.processSnoozeExpirations()

      expect(mockUpdate).toHaveBeenCalledTimes(2)
      
      // Check first alert update preserves other metadata
      expect(mockUpdate).toHaveBeenCalledWith('id', 'alert-123')
      const firstUpdateCall = mockSupabase.from('alerts').update.mock.calls[0][0]
      expect(firstUpdateCall.status).toBe('active')
      expect(firstUpdateCall.metadata.other_data).toBe('preserved')
      expect(firstUpdateCall.metadata.snoozed_until).toBeUndefined()
    })

    it('should handle no expired alerts', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lte: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      } as any)

      await alertManager.processSnoozeExpirations()

      expect(mockSupabase.from).toHaveBeenCalledTimes(1)
    })

    it('should handle null data response', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lte: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any)

      // Should not throw
      await expect(alertManager.processSnoozeExpirations()).resolves.toBeUndefined()
    })
  })

  describe('Alert message formatting', () => {
    it('should format metadata keys correctly', () => {
      const testCases = [
        { input: 'affected_products', expected: 'Affected Products' },
        { input: 'sync_latency_ms', expected: 'Sync Latency Ms' },
        { input: 'single_word', expected: 'Single Word' },
        { input: 'UPPERCASE_KEY', expected: 'UPPERCASE KEY' }
      ]

      for (const testCase of testCases) {
        const result = (alertManager as any).formatMetadataKey(testCase.input)
        expect(result).toBe(testCase.expected)
      }
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