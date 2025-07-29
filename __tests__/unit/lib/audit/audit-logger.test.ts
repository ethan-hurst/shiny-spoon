import { AuditLogger, withAuditLog } from '@/lib/audit/audit-logger'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import type { AuditLogEntry, AuditAction, EntityType } from '@/lib/audit/audit-logger'

jest.mock('@/lib/supabase/server')
jest.mock('next/headers')

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: jest.fn(() => 'test-uuid-123')
} as any

describe('AuditLogger', () => {
  let logger: AuditLogger
  let mockSupabase: any
  let mockHeaders: jest.MockedFunction<typeof headers>
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    
    // Mock headers
    mockHeaders = headers as jest.MockedFunction<typeof headers>
    mockHeaders.mockReturnValue({
      get: jest.fn((header: string) => {
        switch (header) {
          case 'user-agent':
            return 'Mozilla/5.0 Test Browser'
          case 'x-forwarded-for':
            return '192.168.1.1, 10.0.0.1'
          case 'x-real-ip':
            return '192.168.1.1'
          default:
            return null
        }
      })
    } as any)
    
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { 
            user: { 
              id: 'user-123', 
              email: 'test@example.com' 
            } 
          }
        })
      },
      from: jest.fn((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                organization_id: 'org-123',
                role: 'admin',
                full_name: 'Test User'
              }
            })
          }
        }
        return {}
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    }
    
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    
    logger = new AuditLogger()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('log', () => {
    const validEntry: AuditLogEntry = {
      action: 'create',
      entityType: 'product',
      entityId: 'prod-123',
      entityName: 'Test Product',
      newValues: { name: 'Test Product', price: 99.99 }
    }

    it('should create audit log entry with user context', async () => {
      await logger.log(validEntry)

      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles')
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log', {
        p_organization_id: 'org-123',
        p_user_id: 'user-123',
        p_user_email: 'test@example.com',
        p_user_role: 'admin',
        p_action: 'create',
        p_entity_type: 'product',
        p_entity_id: 'prod-123',
        p_entity_name: 'Test Product',
        p_old_values: undefined,
        p_new_values: { name: 'Test Product', price: 99.99 },
        p_metadata: { user_name: 'Test User' },
        p_ip_address: '192.168.1.1',
        p_user_agent: 'Mozilla/5.0 Test Browser',
        p_request_id: 'test-uuid-123'
      })
    })

    it('should handle missing user gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null }
      })

      await logger.log(validEntry)

      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('should handle missing organization gracefully', async () => {
      mockSupabase.from('user_profiles').single.mockResolvedValueOnce({
        data: null
      })

      await logger.log(validEntry)

      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('should include metadata in the log entry', async () => {
      const entryWithMetadata: AuditLogEntry = {
        ...validEntry,
        metadata: {
          source: 'bulk_import',
          importId: 'import-123',
          recordCount: 100
        }
      }

      await logger.log(entryWithMetadata)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log', 
        expect.objectContaining({
          p_metadata: {
            source: 'bulk_import',
            importId: 'import-123',
            recordCount: 100,
            user_name: 'Test User'
          }
        })
      )
    })

    it('should handle IP address extraction from headers', async () => {
      // Test x-forwarded-for parsing
      await logger.log(validEntry)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_ip_address: '192.168.1.1' // First IP from x-forwarded-for
        })
      )

      // Test fallback to x-real-ip
      mockHeaders.mockReturnValueOnce({
        get: jest.fn((header: string) => {
          if (header === 'x-real-ip') return '10.0.0.1'
          return null
        })
      } as any)

      await logger.log(validEntry)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_ip_address: '10.0.0.1'
        })
      )
    })

    it('should handle errors without throwing', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Database error'))

      await logger.log(validEntry)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create audit log:',
        expect.any(Error)
      )
    })

    it('should work with custom supabase client', async () => {
      const customSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'custom-user', email: 'custom@example.com' } }
          })
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              organization_id: 'custom-org',
              role: 'user',
              full_name: 'Custom User'
            }
          })
        })),
        rpc: jest.fn().mockResolvedValue({ data: null, error: null })
      }

      const customLogger = new AuditLogger(customSupabase as any)
      await customLogger.log(validEntry)

      expect(customSupabase.rpc).toHaveBeenCalled()
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })
  })

  describe('helper methods', () => {
    it('should log create action', async () => {
      const entity = {
        id: 'prod-123',
        name: 'New Product',
        sku: 'SKU-001',
        price: 99.99
      }

      await logger.logCreate('product', entity, { source: 'api' })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_action: 'create',
          p_entity_type: 'product',
          p_entity_id: 'prod-123',
          p_entity_name: 'New Product',
          p_new_values: entity,
          p_metadata: expect.objectContaining({ source: 'api' })
        })
      )
    })

    it('should log update action', async () => {
      const oldValues = { name: 'Old Product', price: 79.99 }
      const newValues = { name: 'Updated Product', price: 99.99 }

      await logger.logUpdate('product', 'prod-123', oldValues, newValues, { 
        changedBy: 'price_import' 
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_action: 'update',
          p_entity_type: 'product',
          p_entity_id: 'prod-123',
          p_entity_name: 'Updated Product',
          p_old_values: oldValues,
          p_new_values: newValues,
          p_metadata: expect.objectContaining({ changedBy: 'price_import' })
        })
      )
    })

    it('should log delete action', async () => {
      const entity = {
        id: 'prod-123',
        name: 'Deleted Product',
        sku: 'SKU-001'
      }

      await logger.logDelete('product', entity, { reason: 'discontinued' })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_action: 'delete',
          p_entity_type: 'product',
          p_entity_id: 'prod-123',
          p_entity_name: 'Deleted Product',
          p_old_values: entity,
          p_metadata: expect.objectContaining({ reason: 'discontinued' })
        })
      )
    })

    it('should log export action', async () => {
      const filters = { 
        status: 'active', 
        category: 'electronics' 
      }

      await logger.logExport('product', filters, 150)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_action: 'export',
          p_entity_type: 'product',
          p_metadata: expect.objectContaining({ 
            filters,
            recordCount: 150
          })
        })
      )
    })

    it('should log view action', async () => {
      await logger.logView('order', 'ord-123', 'Order #12345')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_action: 'view',
          p_entity_type: 'order',
          p_entity_id: 'ord-123',
          p_entity_name: 'Order #12345'
        })
      )
    })

    it('should use appropriate name field for entity name', async () => {
      // Test with 'title' field
      const entityWithTitle = {
        id: 'rule-123',
        title: 'Holiday Discount',
        discount: 20
      }

      await logger.logCreate('pricing_rule', entityWithTitle)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_entity_name: 'Holiday Discount'
        })
      )

      // Test with 'sku' field
      const entityWithSku = {
        id: 'inv-123',
        sku: 'SKU-001',
        quantity: 100
      }

      await logger.logCreate('inventory', entityWithSku)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_entity_name: 'SKU-001'
        })
      )
    })
  })

  describe('withAuditLog wrapper', () => {
    it('should wrap successful actions with audit logging', async () => {
      const mockAction = jest.fn().mockResolvedValue({ 
        id: 'result-123', 
        success: true 
      })

      const auditedAction = withAuditLog(
        mockAction,
        (args, result) => ({
          action: 'create',
          entityType: 'product',
          entityId: result?.id,
          newValues: args[0]
        })
      )

      const input = { name: 'Test Product', price: 99.99 }
      const result = await auditedAction(input)

      expect(mockAction).toHaveBeenCalledWith(input)
      expect(result).toEqual({ id: 'result-123', success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_action: 'create',
          p_entity_type: 'product',
          p_entity_id: 'result-123',
          p_new_values: input
        })
      )
    })

    it('should log failed actions with error metadata', async () => {
      const mockAction = jest.fn().mockRejectedValue(new Error('Validation failed'))

      const auditedAction = withAuditLog(
        mockAction,
        (args) => ({
          action: 'create',
          entityType: 'product',
          newValues: args[0]
        })
      )

      const input = { name: 'Invalid Product' }

      await expect(auditedAction(input)).rejects.toThrow('Validation failed')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_action: 'create',
          p_entity_type: 'product',
          p_new_values: input,
          p_metadata: expect.objectContaining({
            error: 'Validation failed',
            failed: true
          })
        })
      )
    })

    it('should preserve function signature and types', async () => {
      const typedAction = async (id: string, data: { name: string }): Promise<{ success: boolean }> => {
        return { success: true }
      }

      const auditedAction = withAuditLog(
        typedAction,
        ([id, data]) => ({
          action: 'update' as AuditAction,
          entityType: 'product' as EntityType,
          entityId: id,
          newValues: data
        })
      )

      // TypeScript should recognize the correct signature
      const result = await auditedAction('prod-123', { name: 'Updated' })
      expect(result.success).toBe(true)
    })

    it('should handle async errors in audit logging', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Audit log failed'))

      const mockAction = jest.fn().mockResolvedValue({ success: true })

      const auditedAction = withAuditLog(
        mockAction,
        () => ({
          action: 'create',
          entityType: 'product'
        })
      )

      const result = await auditedAction()

      // Action should still succeed even if audit logging fails
      expect(result).toEqual({ success: true })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create audit log:',
        expect.any(Error)
      )
    })
  })

  describe('edge cases', () => {
    it('should handle missing headers gracefully', async () => {
      mockHeaders.mockReturnValueOnce({
        get: jest.fn(() => null)
      } as any)

      await logger.log({
        action: 'view',
        entityType: 'product',
        entityId: 'prod-123'
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
        expect.objectContaining({
          p_ip_address: null,
          p_user_agent: ''
        })
      )
    })

    it('should handle all action types', async () => {
      const actions: AuditAction[] = [
        'create', 'update', 'delete', 'view', 'export', 
        'login', 'logout', 'invite', 'sync', 'approve', 'reject'
      ]

      for (const action of actions) {
        await logger.log({
          action,
          entityType: 'product'
        })

        expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
          expect.objectContaining({
            p_action: action
          })
        )
      }
    })

    it('should handle all entity types', async () => {
      const entityTypes: EntityType[] = [
        'product', 'inventory', 'order', 'customer', 
        'pricing_rule', 'warehouse', 'integration', 'user', 'organization'
      ]

      for (const entityType of entityTypes) {
        await logger.log({
          action: 'view',
          entityType
        })

        expect(mockSupabase.rpc).toHaveBeenCalledWith('create_audit_log',
          expect.objectContaining({
            p_entity_type: entityType
          })
        )
      }
    })
  })
})