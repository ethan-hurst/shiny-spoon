import { AuditLogger, withAuditLog, type AuditAction, type EntityType } from '@/lib/audit/audit-logger'
import { createServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('next/headers')

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    insert: jest.fn(),
  })),
}

const mockHeaders = {
  get: jest.fn(),
}

;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
;(headers as jest.Mock).mockReturnValue(mockHeaders)

describe('AuditLogger', () => {
  let auditLogger: AuditLogger

  beforeEach(() => {
    jest.clearAllMocks()
    auditLogger = new AuditLogger()
    
    // Setup default mock returns
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
    })

    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: {
        organization_id: 'org-123',
        role: 'admin',
        full_name: 'Test User',
      },
    })

    mockSupabase.from().insert.mockResolvedValue({ error: null })

    mockHeaders.get.mockImplementation((header: string) => {
      switch (header) {
        case 'user-agent':
          return 'Mozilla/5.0 Test Browser'
        case 'x-forwarded-for':
          return '192.168.1.1,10.0.0.1'
        case 'x-real-ip':
          return '192.168.1.1'
        default:
          return null
      }
    })
  })

  describe('log', () => {
    it('should create an audit log entry with all required fields', async () => {
      const entry = {
        action: 'create' as AuditAction,
        entityType: 'product' as EntityType,
        entityId: 'product-123',
        entityName: 'Test Product',
        newValues: { name: 'Test Product', price: 100 },
        metadata: { source: 'api' },
      }

      await auditLogger.log(entry)

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        organization_id: 'org-123',
        user_id: 'user-123',
        user_email: 'test@example.com',
        user_role: 'admin',
        action: 'create',
        entity_type: 'product',
        entity_id: 'product-123',
        entity_name: 'Test Product',
        old_values: undefined,
        new_values: { name: 'Test Product', price: 100 },
        metadata: {
          source: 'api',
          user_name: 'Test User',
        },
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0 Test Browser',
      })
    })

    it('should handle missing user gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const entry = {
        action: 'create' as AuditAction,
        entityType: 'product' as EntityType,
      }

      await auditLogger.log(entry)

      expect(mockSupabase.from().insert).not.toHaveBeenCalled()
    })

    it('should handle missing user profile gracefully', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
      })

      const entry = {
        action: 'create' as AuditAction,
        entityType: 'product' as EntityType,
      }

      await auditLogger.log(entry)

      expect(mockSupabase.from().insert).not.toHaveBeenCalled()
    })

    it('should extract IP address from x-forwarded-for header', async () => {
      const entry = {
        action: 'create' as AuditAction,
        entityType: 'product' as EntityType,
      }

      await auditLogger.log(entry)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: '192.168.1.1',
        })
      )
    })

    it('should fall back to x-real-ip when x-forwarded-for is not available', async () => {
      mockHeaders.get.mockImplementation((header: string) => {
        switch (header) {
          case 'user-agent':
            return 'Mozilla/5.0 Test Browser'
          case 'x-real-ip':
            return '10.0.0.1'
          default:
            return null
        }
      })

      const entry = {
        action: 'create' as AuditAction,
        entityType: 'product' as EntityType,
      }

      await auditLogger.log(entry)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: '10.0.0.1',
        })
      )
    })

    it('should handle database insertion errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      mockSupabase.from().insert.mockRejectedValue(new Error('Database error'))

      const entry = {
        action: 'create' as AuditAction,
        entityType: 'product' as EntityType,
      }

      // Should not throw
      await expect(auditLogger.log(entry)).resolves.toBeUndefined()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create audit log:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle all supported action types', async () => {
      const actions: AuditAction[] = [
        'create',
        'update',
        'delete',
        'view',
        'export',
        'login',
        'logout',
        'invite',
        'sync',
        'approve',
        'reject',
      ]

      for (const action of actions) {
        await auditLogger.log({
          action,
          entityType: 'product',
        })

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({ action })
        )
      }
    })

    it('should handle all supported entity types', async () => {
      const entityTypes: EntityType[] = [
        'product',
        'inventory',
        'order',
        'customer',
        'pricing_rule',
        'warehouse',
        'integration',
        'user',
        'organization',
      ]

      for (const entityType of entityTypes) {
        await auditLogger.log({
          action: 'create',
          entityType,
        })

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({ entity_type: entityType })
        )
      }
    })
  })

  describe('helper methods', () => {
    describe('logCreate', () => {
      it('should log create action with entity data', async () => {
        const entity = {
          id: 'product-123',
          name: 'Test Product',
          price: 100,
        }

        await auditLogger.logCreate('product', entity, { source: 'api' })

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'create',
            entity_type: 'product',
            entity_id: 'product-123',
            entity_name: 'Test Product',
            new_values: entity,
            metadata: expect.objectContaining({ source: 'api' }),
          })
        )
      })

      it('should use SKU as entity name when name is not available', async () => {
        const entity = {
          id: 'product-123',
          sku: 'TEST-SKU-001',
          price: 100,
        }

        await auditLogger.logCreate('product', entity)

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            entity_name: 'TEST-SKU-001',
          })
        )
      })
    })

    describe('logUpdate', () => {
      it('should log update action with old and new values', async () => {
        const oldValues = { name: 'Old Product', price: 100 }
        const newValues = { name: 'Updated Product', price: 150 }

        await auditLogger.logUpdate(
          'product',
          'product-123',
          oldValues,
          newValues,
          { reason: 'price_adjustment' }
        )

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'update',
            entity_type: 'product',
            entity_id: 'product-123',
            entity_name: 'Updated Product',
            old_values: oldValues,
            new_values: newValues,
            metadata: expect.objectContaining({ reason: 'price_adjustment' }),
          })
        )
      })
    })

    describe('logDelete', () => {
      it('should log delete action with entity data', async () => {
        const entity = {
          id: 'product-123',
          name: 'Test Product',
          price: 100,
        }

        await auditLogger.logDelete('product', entity, { reason: 'discontinued' })

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'delete',
            entity_type: 'product',
            entity_id: 'product-123',
            entity_name: 'Test Product',
            old_values: entity,
            metadata: expect.objectContaining({ reason: 'discontinued' }),
          })
        )
      })
    })

    describe('logExport', () => {
      it('should log export action with filters and record count', async () => {
        const filters = { category: 'electronics', active: true }
        const recordCount = 150

        await auditLogger.logExport('product', filters, recordCount)

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'export',
            entity_type: 'product',
            metadata: expect.objectContaining({
              filters,
              recordCount,
            }),
          })
        )
      })
    })

    describe('logView', () => {
      it('should log view action with entity information', async () => {
        await auditLogger.logView('product', 'product-123', 'Test Product')

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'view',
            entity_type: 'product',
            entity_id: 'product-123',
            entity_name: 'Test Product',
          })
        )
      })

      it('should work without entity name', async () => {
        await auditLogger.logView('product', 'product-123')

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'view',
            entity_type: 'product',
            entity_id: 'product-123',
            entity_name: undefined,
          })
        )
      })
    })
  })

  describe('withAuditLog wrapper', () => {
    it('should wrap a function and log successful execution', async () => {
      const mockAction = jest.fn().mockResolvedValue({ id: 'product-123', name: 'Test Product' })
      const getAuditInfo = jest.fn().mockReturnValue({
        action: 'create' as AuditAction,
        entityType: 'product' as EntityType,
        entityId: 'product-123',
        entityName: 'Test Product',
      })

      const wrappedAction = withAuditLog(mockAction, getAuditInfo)

      const result = await wrappedAction('arg1', 'arg2')

      expect(mockAction).toHaveBeenCalledWith('arg1', 'arg2')
      expect(getAuditInfo).toHaveBeenCalledWith(['arg1', 'arg2'], { id: 'product-123', name: 'Test Product' })
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entity_type: 'product',
          entity_id: 'product-123',
          entity_name: 'Test Product',
        })
      )
      expect(result).toEqual({ id: 'product-123', name: 'Test Product' })
    })

    it('should log failed execution and re-throw error', async () => {
      const error = new Error('Action failed')
      const mockAction = jest.fn().mockRejectedValue(error)
      const getAuditInfo = jest.fn().mockReturnValue({
        action: 'create' as AuditAction,
        entityType: 'product' as EntityType,
      })

      const wrappedAction = withAuditLog(mockAction, getAuditInfo)

      await expect(wrappedAction('arg1')).rejects.toThrow('Action failed')

      expect(getAuditInfo).toHaveBeenCalledWith(['arg1'])
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            error: 'Action failed',
            failed: true,
          }),
        })
      )
    })

    it('should preserve function signature and arguments', async () => {
      type TestFunction = (a: string, b: number, c: boolean) => Promise<string>
      
      const mockAction: TestFunction = jest.fn().mockResolvedValue('success')
      const getAuditInfo = jest.fn().mockReturnValue({
        action: 'create' as AuditAction,
        entityType: 'product' as EntityType,
      })

      const wrappedAction = withAuditLog(mockAction, getAuditInfo)

      const result = await wrappedAction('test', 42, true)

      expect(mockAction).toHaveBeenCalledWith('test', 42, true)
      expect(result).toBe('success')
    })
  })

  describe('custom supabase client', () => {
    it('should use provided supabase client', async () => {
      const customSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'custom-user', email: 'custom@example.com' } },
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { organization_id: 'custom-org', role: 'user', full_name: 'Custom User' },
              }),
            })),
          })),
          insert: jest.fn().mockResolvedValue({ error: null }),
        })),
      }

      const customAuditLogger = new AuditLogger(customSupabase as any)

      await customAuditLogger.log({
        action: 'create',
        entityType: 'product',
      })

      expect(customSupabase.auth.getUser).toHaveBeenCalled()
      expect(customSupabase.from).toHaveBeenCalledWith('user_profiles')
      expect(customSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'custom-user',
          organization_id: 'custom-org',
        })
      )
    })
  })
})