import { exportAuditLogs, generateComplianceReport } from '@/app/actions/audit'
import { createServerClient } from '@/lib/supabase/server'
import { generateCSV } from '@/lib/csv/parser'
import { format } from 'date-fns'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('@/lib/csv/parser')
jest.mock('@/lib/audit/audit-logger')

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(),
            })),
          })),
        })),
      })),
    })),
  })),
}

;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
;(generateCSV as jest.Mock).mockReturnValue('mocked,csv,data\nrow1,row2,row3')

// Mock AuditLogger
const mockAuditLogger = {
  logExport: jest.fn(),
  log: jest.fn(),
}

jest.doMock('@/lib/audit/audit-logger', () => ({
  AuditLogger: jest.fn(() => mockAuditLogger),
}))

describe('Audit Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock returns
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
    })
  })

  describe('exportAuditLogs', () => {
    const mockFilters = {
      from: new Date('2024-01-01'),
      to: new Date('2024-01-31'),
      user_id: 'user-123',
      action: 'create',
      entity_type: 'product',
    }

    const mockAuditLogs = [
      {
        id: 'log-1',
        created_at: '2024-01-15T10:00:00Z',
        user_email: 'test@example.com',
        user_name: 'Test User',
        action: 'create',
        entity_type: 'product',
        entity_name: 'Test Product',
        ip_address: '192.168.1.1',
        old_values: null,
        new_values: { name: 'Test Product', price: 100 },
      },
      {
        id: 'log-2',
        created_at: '2024-01-16T11:00:00Z',
        user_email: 'test@example.com',
        user_name: 'Test User',
        action: 'update',
        entity_type: 'product',
        entity_name: 'Test Product',
        ip_address: '192.168.1.1',
        old_values: { name: 'Test Product', price: 100 },
        new_values: { name: 'Test Product', price: 150 },
      },
    ]

    beforeEach(() => {
      // Setup query chain mock
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockAuditLogs,
          error: null,
        }),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(mockQuery),
      })
    })

    it('should export audit logs as CSV with proper formatting', async () => {
      const result = await exportAuditLogs({
        organizationId: 'org-123',
        filters: mockFilters,
        format: 'csv',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs_with_details')
      expect(generateCSV).toHaveBeenCalledWith(
        [
          {
            timestamp: '2024-01-15 10:00:00',
            user_email: 'test@example.com',
            user_name: 'Test User',
            action: 'create',
            entity_type: 'product',
            entity_name: 'Test Product',
            ip_address: '192.168.1.1',
            changes: '',
          },
          {
            timestamp: '2024-01-16 11:00:00',
            user_email: 'test@example.com',
            user_name: 'Test User',
            action: 'update',
            entity_type: 'product',
            entity_name: 'Test Product',
            ip_address: '192.168.1.1',
            changes: expect.stringContaining('name'),
          },
        ],
        [
          { key: 'timestamp', header: 'Timestamp' },
          { key: 'user_email', header: 'User Email' },
          { key: 'user_name', header: 'User Name' },
          { key: 'action', header: 'Action' },
          { key: 'entity_type', header: 'Entity Type' },
          { key: 'entity_name', header: 'Entity Name' },
          { key: 'ip_address', header: 'IP Address' },
          { key: 'changes', header: 'Changes' },
        ]
      )

      expect(result).toEqual({
        data: 'mocked,csv,data\nrow1,row2,row3',
        filename: expect.stringMatching(/^audit_logs_\d{4}-\d{2}-\d{2}_\d{6}\.csv$/),
      })
    })

    it('should export audit logs as JSON', async () => {
      const result = await exportAuditLogs({
        organizationId: 'org-123',
        filters: mockFilters,
        format: 'json',
      })

      expect(result).toEqual({
        data: JSON.stringify(mockAuditLogs, null, 2),
        filename: expect.stringMatching(/^audit_logs_\d{4}-\d{2}-\d{2}_\d{6}\.json$/),
      })

      expect(generateCSV).not.toHaveBeenCalled()
    })

    it('should apply all filters to the query', async () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockAuditLogs,
          error: null,
        }),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(mockQuery),
      })

      await exportAuditLogs({
        organizationId: 'org-123',
        filters: mockFilters,
        format: 'csv',
      })

      expect(mockQuery.eq).toHaveBeenCalledWith('organization_id', 'org-123')
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(mockQuery.eq).toHaveBeenCalledWith('action', 'create')
      expect(mockQuery.eq).toHaveBeenCalledWith('entity_type', 'product')
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', mockFilters.from.toISOString())
      expect(mockQuery.lte).toHaveBeenCalledWith('created_at', mockFilters.to.toISOString())
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(mockQuery.limit).toHaveBeenCalledWith(10000)
    })

    it('should skip optional filters when not provided', async () => {
      const minimalFilters = {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      }

      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockAuditLogs,
          error: null,
        }),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(mockQuery),
      })

      await exportAuditLogs({
        organizationId: 'org-123',
        filters: minimalFilters,
        format: 'csv',
      })

      expect(mockQuery.eq).toHaveBeenCalledWith('organization_id', 'org-123')
      expect(mockQuery.eq).toHaveBeenCalledTimes(1) // Only organization_id
    })

    it('should log the export action', async () => {
      await exportAuditLogs({
        organizationId: 'org-123',
        filters: mockFilters,
        format: 'csv',
      })

      expect(mockAuditLogger.logExport).toHaveBeenCalledWith(
        'audit_log',
        mockFilters,
        mockAuditLogs.length
      )
    })

    it('should handle unauthorized users', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const result = await exportAuditLogs({
        organizationId: 'org-123',
        filters: mockFilters,
        format: 'csv',
      })

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should handle database errors', async () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Database error')),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(mockQuery),
      })

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await exportAuditLogs({
        organizationId: 'org-123',
        filters: mockFilters,
        format: 'csv',
      })

      expect(result).toEqual({ error: 'Failed to export audit logs' })
      expect(consoleErrorSpy).toHaveBeenCalledWith('Export error:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })

    it('should generate proper change summaries for CSV export', async () => {
      await exportAuditLogs({
        organizationId: 'org-123',
        filters: mockFilters,
        format: 'csv',
      })

      const csvData = (generateCSV as jest.Mock).mock.calls[0][0]
      
      // First log has no changes (create action)
      expect(csvData[0].changes).toBe('')
      
      // Second log has changes (update action)
      expect(csvData[1].changes).toContain('price')
    })
  })

  describe('generateComplianceReport', () => {
    const mockDateRange = {
      from: new Date('2024-01-01'),
      to: new Date('2024-01-31'),
    }

    const mockMetrics = [
      { action: 'create', entity_type: 'product', user_id: 'user-1' },
      { action: 'update', entity_type: 'product', user_id: 'user-1' },
      { action: 'delete', entity_type: 'product', user_id: 'user-2' },
      { action: 'login', entity_type: 'user', user_id: 'user-1' },
      { action: 'logout', entity_type: 'user', user_id: 'user-1' },
      { action: 'view', entity_type: 'product', user_id: 'user-2' },
    ]

    beforeEach(() => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      }

      mockQuery.lte.mockResolvedValue({
        data: mockMetrics,
        error: null,
      })

      mockSupabase.from.mockReturnValue(mockQuery)
    })

    it('should generate SOC 2 compliance report', async () => {
      const result = await generateComplianceReport({
        organizationId: 'org-123',
        reportType: 'soc2',
        dateRange: mockDateRange,
      })

      expect(result.success).toBe(true)
      expect(result.report).toEqual({
        type: 'soc2',
        period: {
          from: '2024-01-01',
          to: '2024-01-31',
        },
        summary: {
          total_actions: 6,
          unique_users: 2,
          data_modifications: 3, // create, update, delete
          authentication_events: 2, // login, logout
        },
        compliance_checks: {
          access_control: true,
          data_retention: true,
          audit_completeness: true,
          user_authentication: true,
        },
      })
    })

    it('should generate ISO 27001 compliance report', async () => {
      const result = await generateComplianceReport({
        organizationId: 'org-123',
        reportType: 'iso27001',
        dateRange: mockDateRange,
      })

      expect(result.report?.type).toBe('iso27001')
      expect(result.success).toBe(true)
    })

    it('should generate custom compliance report', async () => {
      const result = await generateComplianceReport({
        organizationId: 'org-123',
        reportType: 'custom',
        dateRange: mockDateRange,
      })

      expect(result.report?.type).toBe('custom')
      expect(result.success).toBe(true)
    })

    it('should query metrics with correct filters', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      }

      mockQuery.lte.mockResolvedValue({
        data: mockMetrics,
        error: null,
      })

      mockSupabase.from.mockReturnValue(mockQuery)

      await generateComplianceReport({
        organizationId: 'org-123',
        reportType: 'soc2',
        dateRange: mockDateRange,
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs')
      expect(mockQuery.select).toHaveBeenCalledWith('action, entity_type, user_id')
      expect(mockQuery.eq).toHaveBeenCalledWith('organization_id', 'org-123')
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', mockDateRange.from.toISOString())
      expect(mockQuery.lte).toHaveBeenCalledWith('created_at', mockDateRange.to.toISOString())
    })

    it('should log the report generation action', async () => {
      await generateComplianceReport({
        organizationId: 'org-123',
        reportType: 'soc2',
        dateRange: mockDateRange,
      })

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        action: 'export',
        entityType: 'organization',
        metadata: {
          report_type: 'soc2',
          date_range: mockDateRange,
        },
      })
    })

    it('should handle unauthorized users', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const result = await generateComplianceReport({
        organizationId: 'org-123',
        reportType: 'soc2',
        dateRange: mockDateRange,
      })

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should handle database errors', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockRejectedValue(new Error('Database error')),
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await generateComplianceReport({
        organizationId: 'org-123',
        reportType: 'soc2',
        dateRange: mockDateRange,
      })

      expect(result).toEqual({ error: 'Failed to generate compliance report' })
      expect(consoleErrorSpy).toHaveBeenCalledWith('Compliance report error:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })

    it('should handle empty metrics gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      const result = await generateComplianceReport({
        organizationId: 'org-123',
        reportType: 'soc2',
        dateRange: mockDateRange,
      })

      expect(result.report?.summary).toEqual({
        total_actions: 0,
        unique_users: 0,
        data_modifications: 0,
        authentication_events: 0,
      })
    })

    it('should calculate metrics correctly with various actions', async () => {
      const result = await generateComplianceReport({
        organizationId: 'org-123',
        reportType: 'soc2',
        dateRange: mockDateRange,
      })

      expect(result.report?.summary.total_actions).toBe(6)
      expect(result.report?.summary.unique_users).toBe(2)
      expect(result.report?.summary.data_modifications).toBe(3) // create, update, delete
      expect(result.report?.summary.authentication_events).toBe(2) // login, logout
    })
  })
})