import { expect, test } from '@jest/globals'
import { AuditLogger } from '@/lib/audit/audit-logger'
import { createServerClient } from '@/lib/supabase/server'
import { exportAuditLogs, generateComplianceReport } from '@/app/actions/audit'

// Mock Next.js headers
jest.mock('next/headers', () => ({
  headers: () => ({
    get: (name: string) => {
      switch (name) {
        case 'user-agent':
          return 'Jest Test Runner'
        case 'x-forwarded-for':
          return '127.0.0.1'
        default:
          return null
      }
    },
  }),
}))

// Integration test setup - these would connect to a test database
describe('Audit Trail Integration Tests', () => {
  let supabase: ReturnType<typeof createServerClient>
  let auditLogger: AuditLogger
  let testOrgId: string
  let testUserId: string

  beforeAll(async () => {
    // Setup test database connection
    supabase = createServerClient()
    auditLogger = new AuditLogger(supabase)

    // Create test organization and user
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Test Organization',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (orgError) throw orgError
    testOrgId = org.id

    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: 'test@audit-integration.com',
        password: 'test-password-123',
        email_confirm: true,
      })

    if (authError) throw authError
    testUserId = authUser.user.id

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: testUserId,
        organization_id: testOrgId,
        role: 'admin',
        full_name: 'Test Admin',
        email: 'test@audit-integration.com',
      })

    if (profileError) throw profileError
  })

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('audit_logs').delete().eq('organization_id', testOrgId)
    await supabase.from('user_profiles').delete().eq('user_id', testUserId)
    await supabase.from('organizations').delete().eq('id', testOrgId)
    await supabase.auth.admin.deleteUser(testUserId)
  })

  describe('End-to-End Audit Logging Workflow', () => {
    test('should create, update, delete product with complete audit trail', async () => {
      // Mock authentication
      jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: testUserId, email: 'test@audit-integration.com' } },
        error: null,
      })

      // Step 1: Create product with audit logging
      const createData = {
        id: 'product-integration-test',
        name: 'Integration Test Product',
        sku: 'INTEG-001',
        price: 100,
        category: 'test',
      }

      await auditLogger.logCreate('product', createData, {
        source: 'integration_test',
        operation: 'create_product',
      })

      // Step 2: Update product with audit logging
      const oldData = { ...createData }
      const newData = {
        ...createData,
        price: 150,
        name: 'Updated Integration Product',
      }

      await auditLogger.logUpdate('product', createData.id, oldData, newData, {
        source: 'integration_test',
        operation: 'update_product',
        reason: 'price_adjustment',
      })

      // Step 3: Delete product with audit logging
      await auditLogger.logDelete('product', newData, {
        source: 'integration_test',
        operation: 'delete_product',
        reason: 'discontinued',
      })

      // Step 4: Verify audit logs were created
      const { data: auditLogs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', testOrgId)
        .eq('entity_id', createData.id)
        .order('created_at', { ascending: true })

      expect(error).toBeNull()
      expect(auditLogs).toHaveLength(3)

      // Verify create log
      const createLog = auditLogs[0]
      expect(createLog.action).toBe('create')
      expect(createLog.entity_type).toBe('product')
      expect(createLog.entity_name).toBe('Integration Test Product')
      expect(createLog.new_values).toEqual(createData)
      expect(createLog.old_values).toBeNull()
      expect(createLog.metadata).toMatchObject({
        source: 'integration_test',
        operation: 'create_product',
      })

      // Verify update log
      const updateLog = auditLogs[1]
      expect(updateLog.action).toBe('update')
      expect(updateLog.entity_name).toBe('Updated Integration Product')
      expect(updateLog.old_values).toEqual(oldData)
      expect(updateLog.new_values).toEqual(newData)
      expect(updateLog.metadata).toMatchObject({
        reason: 'price_adjustment',
      })

      // Verify delete log
      const deleteLog = auditLogs[2]
      expect(deleteLog.action).toBe('delete')
      expect(deleteLog.old_values).toEqual(newData)
      expect(deleteLog.new_values).toBeNull()
      expect(deleteLog.metadata).toMatchObject({
        reason: 'discontinued',
      })

      // Step 5: Verify context information is captured
      auditLogs.forEach((log) => {
        expect(log.user_id).toBe(testUserId)
        expect(log.user_email).toBe('test@audit-integration.com')
        expect(log.organization_id).toBe(testOrgId)
        expect(log.ip_address).toBe('127.0.0.1')
        expect(log.user_agent).toBe('Jest Test Runner')
        expect(log.created_at).toBeDefined()
      })
    })

    test('should handle bulk operations with efficient audit logging', async () => {
      const products = Array.from({ length: 50 }, (_, i) => ({
        id: `bulk-product-${i}`,
        name: `Bulk Product ${i}`,
        sku: `BULK-${i.toString().padStart(3, '0')}`,
        price: 50 + i,
        category: 'bulk_test',
      }))

      // Log bulk creation
      const startTime = Date.now()

      for (const product of products) {
        await auditLogger.logCreate('product', product, {
          source: 'bulk_operation',
          batch_id: 'bulk-test-001',
        })
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete bulk operations in reasonable time
      expect(duration).toBeLessThan(5000) // 5 seconds for 50 operations

      // Verify all logs were created
      const { data: bulkLogs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', testOrgId)
        .eq('action', 'create')
        .eq('entity_type', 'product')
        .like('entity_id', 'bulk-product-%')

      expect(error).toBeNull()
      expect(bulkLogs).toHaveLength(50)

      // Verify metadata consistency
      bulkLogs.forEach((log) => {
        expect(log.metadata).toMatchObject({
          source: 'bulk_operation',
          batch_id: 'bulk-test-001',
        })
      })
    })

    test('should export audit logs with correct filtering and formatting', async () => {
      // Create test data with different filters
      await Promise.all([
        auditLogger.logCreate('product', {
          id: 'export-product-1',
          name: 'Export Product 1',
        }),
        auditLogger.logCreate('customer', {
          id: 'export-customer-1',
          name: 'Export Customer 1',
        }),
        auditLogger.logView('product', 'export-product-1', 'Export Product 1'),
        auditLogger.logExport('product', { category: 'electronics' }, 100),
      ])

      // Test CSV export with filters
      const csvResult = await exportAuditLogs({
        organizationId: testOrgId,
        filters: {
          from: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          to: new Date(),
          action: 'create',
          entity_type: 'product',
        },
        format: 'csv',
      })

      expect(csvResult.error).toBeUndefined()
      expect(csvResult.data).toBeDefined()
      expect(csvResult.filename).toMatch(/\.csv$/)

      // Parse CSV to verify content
      const csvLines = csvResult.data!.split('\n')
      expect(csvLines[0]).toContain('timestamp') // Header row
      expect(csvLines.length).toBeGreaterThan(1) // At least one data row

      // Test JSON export
      const jsonResult = await exportAuditLogs({
        organizationId: testOrgId,
        filters: {
          from: new Date(Date.now() - 24 * 60 * 60 * 1000),
          to: new Date(),
        },
        format: 'json',
      })

      expect(jsonResult.error).toBeUndefined()
      expect(jsonResult.data).toBeDefined()
      expect(jsonResult.filename).toMatch(/\.json$/)

      // Parse JSON to verify structure
      const jsonData = JSON.parse(jsonResult.data!)
      expect(Array.isArray(jsonData)).toBe(true)
      expect(jsonData.length).toBeGreaterThan(0)

      // Verify JSON structure
      const firstLog = jsonData[0]
      expect(firstLog).toHaveProperty('id')
      expect(firstLog).toHaveProperty('created_at')
      expect(firstLog).toHaveProperty('action')
      expect(firstLog).toHaveProperty('entity_type')
      expect(firstLog).toHaveProperty('user_email')
    })

    test('should generate compliance reports with accurate metrics', async () => {
      // Create diverse audit data for compliance testing
      const testActions = [
        { action: 'login', entityType: 'user', userId: testUserId },
        { action: 'logout', entityType: 'user', userId: testUserId },
        { action: 'create', entityType: 'product', userId: testUserId },
        { action: 'update', entityType: 'product', userId: testUserId },
        { action: 'delete', entityType: 'customer', userId: testUserId },
        { action: 'view', entityType: 'order', userId: testUserId },
        { action: 'export', entityType: 'product', userId: testUserId },
      ]

      // Log test actions
      for (const { action, entityType, userId } of testActions) {
        await auditLogger.log({
          action: action as any,
          entityType: entityType as any,
          entityId: `compliance-test-${action}`,
          entityName: `Compliance Test ${action}`,
          metadata: { compliance_test: true },
        })
      }

      // Generate SOC 2 compliance report
      const soc2Result = await generateComplianceReport({
        organizationId: testOrgId,
        reportType: 'soc2',
        dateRange: {
          from: new Date(Date.now() - 24 * 60 * 60 * 1000),
          to: new Date(),
        },
      })

      expect(soc2Result.error).toBeUndefined()
      expect(soc2Result.success).toBe(true)
      expect(soc2Result.report).toBeDefined()

      const report = soc2Result.report!
      expect(report.type).toBe('soc2')
      expect(report.summary.total_actions).toBeGreaterThanOrEqual(7)
      expect(report.summary.unique_users).toBeGreaterThanOrEqual(1)
      expect(report.summary.data_modifications).toBeGreaterThanOrEqual(3) // create, update, delete
      expect(report.summary.authentication_events).toBeGreaterThanOrEqual(2) // login, logout

      // Verify compliance checks
      expect(report.compliance_checks.access_control).toBe(true)
      expect(report.compliance_checks.data_retention).toBe(true)
      expect(report.compliance_checks.audit_completeness).toBe(true)
      expect(report.compliance_checks.user_authentication).toBe(true)

      // Generate ISO 27001 compliance report
      const iso27001Result = await generateComplianceReport({
        organizationId: testOrgId,
        reportType: 'iso27001',
        dateRange: {
          from: new Date(Date.now() - 24 * 60 * 60 * 1000),
          to: new Date(),
        },
      })

      expect(iso27001Result.error).toBeUndefined()
      expect(iso27001Result.success).toBe(true)
      expect(iso27001Result.report?.type).toBe('iso27001')
    })

    test('should maintain data integrity with concurrent operations', async () => {
      const concurrentOperations = 20
      const entityId = 'concurrent-test-product'

      // Create concurrent audit logging operations
      const promises = Array.from(
        { length: concurrentOperations },
        async (_, i) => {
          await auditLogger.log({
            action: 'update',
            entityType: 'product',
            entityId,
            entityName: 'Concurrent Test Product',
            oldValues: { version: i },
            newValues: { version: i + 1 },
            metadata: {
              operation_index: i,
              concurrent_test: true,
            },
          })
        }
      )

      // Execute all operations concurrently
      await Promise.all(promises)

      // Verify all operations were logged
      const { data: concurrentLogs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', testOrgId)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true })

      expect(error).toBeNull()
      expect(concurrentLogs).toHaveLength(concurrentOperations)

      // Verify each operation was logged correctly
      concurrentLogs.forEach((log, index) => {
        expect(log.action).toBe('update')
        expect(log.entity_type).toBe('product')
        expect(log.entity_id).toBe(entityId)
        expect(log.metadata).toMatchObject({
          concurrent_test: true,
        })
      })

      // Verify operation indices are unique (no lost updates)
      const operationIndices = concurrentLogs.map(
        (log) => log.metadata.operation_index
      )
      const uniqueIndices = new Set(operationIndices)
      expect(uniqueIndices.size).toBe(concurrentOperations)
    })

    test('should handle audit logging failures gracefully', async () => {
      // Test with invalid data that should be handled gracefully
      const invalidOperations = [
        // Missing required fields should not crash
        () =>
          auditLogger.log({
            action: 'create',
            entityType: undefined as any,
          }),
        // Extremely large data should be truncated or handled
        () =>
          auditLogger.log({
            action: 'create',
            entityType: 'product',
            newValues: {
              large_data: 'x'.repeat(100000), // Very large string
            },
          }),
      ]

      // All operations should complete without throwing
      for (const operation of invalidOperations) {
        await expect(operation()).resolves.not.toThrow()
      }

      // System should remain functional after handling invalid operations
      await expect(
        auditLogger.logCreate('product', {
          id: 'recovery-test',
          name: 'Recovery Test Product',
        })
      ).resolves.not.toThrow()
    })

    test('should respect retention policies during cleanup', async () => {
      // Create audit logs with different ages
      const oldLogId = 'old-retention-test'
      const recentLogId = 'recent-retention-test'

      // Insert old log (older than retention policy)
      await supabase.from('audit_logs').insert({
        organization_id: testOrgId,
        user_id: testUserId,
        user_email: 'test@audit-integration.com',
        action: 'create',
        entity_type: 'product',
        entity_id: oldLogId,
        entity_name: 'Old Product',
        created_at: new Date(
          Date.now() - 95 * 24 * 60 * 60 * 1000
        ).toISOString(), // 95 days old
      })

      // Insert recent log (within retention policy)
      await supabase.from('audit_logs').insert({
        organization_id: testOrgId,
        user_id: testUserId,
        user_email: 'test@audit-integration.com',
        action: 'create',
        entity_type: 'product',
        entity_id: recentLogId,
        entity_name: 'Recent Product',
        created_at: new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString(), // 30 days old
      })

      // Set retention policy for products (90 days)
      await supabase.from('audit_retention_policies').upsert({
        organization_id: testOrgId,
        entity_type: 'product',
        retention_days: 90,
        is_active: true,
      })

      // Run cleanup function
      const { error: cleanupError } = await supabase.rpc('cleanup_audit_logs')
      expect(cleanupError).toBeNull()

      // Verify old log was removed
      const { data: oldLog } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', oldLogId)
        .single()
      expect(oldLog).toBeNull()

      // Verify recent log was kept
      const { data: recentLog } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', recentLogId)
        .single()
      expect(recentLog).not.toBeNull()
    })

    test('should maintain audit log integrity across database transactions', async () => {
      const transactionTestId = 'transaction-test-product'

      try {
        // Simulate a business transaction that includes audit logging
        await supabase.rpc('begin_transaction')

        // Step 1: Log product creation
        await auditLogger.logCreate(
          'product',
          {
            id: transactionTestId,
            name: 'Transaction Test Product',
            price: 100,
          },
          { transaction_test: true }
        )

        // Step 2: Log inventory addition
        await auditLogger.logCreate(
          'inventory',
          {
            id: `${transactionTestId}-inventory`,
            product_id: transactionTestId,
            quantity: 50,
          },
          { transaction_test: true }
        )

        // Step 3: Simulate transaction commit
        await supabase.rpc('commit_transaction')

        // Verify both audit logs exist
        const { data: transactionLogs, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('organization_id', testOrgId)
          .like('entity_id', `${transactionTestId}%`)

        expect(error).toBeNull()
        expect(transactionLogs).toHaveLength(2)

        transactionLogs.forEach((log) => {
          expect(log.metadata).toMatchObject({ transaction_test: true })
        })
      } catch (error) {
        // Rollback on error
        await supabase.rpc('rollback_transaction')
        throw error
      }
    })
  })

  describe('Performance and Scalability Tests', () => {
    test('should handle high-volume audit logging efficiently', async () => {
      const volumeTestCount = 1000
      const batchSize = 100

      const startTime = Date.now()

      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < volumeTestCount; i += batchSize) {
        const batch = Array.from(
          { length: Math.min(batchSize, volumeTestCount - i) },
          (_, j) => {
            const index = i + j
            return auditLogger.log({
              action: 'view',
              entityType: 'product',
              entityId: `volume-test-${index}`,
              entityName: `Volume Test Product ${index}`,
              metadata: {
                volume_test: true,
                batch_index: Math.floor(i / batchSize),
                item_index: j,
              },
            })
          }
        )

        await Promise.all(batch)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should handle high volume efficiently (under 30 seconds for 1000 operations)
      expect(duration).toBeLessThan(30000)

      // Verify all logs were created
      const {
        data: volumeLogs,
        count,
        error,
      } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('organization_id', testOrgId)
        .like('entity_id', 'volume-test-%')

      expect(error).toBeNull()
      expect(count).toBe(volumeTestCount)

      // Calculate average processing time per operation
      const avgTimePerOp = duration / volumeTestCount
      expect(avgTimePerOp).toBeLessThan(100) // Under 100ms per operation

      console.log(
        `High-volume audit logging: ${volumeTestCount} operations in ${duration}ms (${avgTimePerOp.toFixed(2)}ms avg per operation)`
      )
    })

    test('should optimize query performance with proper indexing', async () => {
      // Test common query patterns
      const queryTests = [
        {
          name: 'Organization filter',
          query: () =>
            supabase
              .from('audit_logs')
              .select('*')
              .eq('organization_id', testOrgId)
              .limit(100),
        },
        {
          name: 'Date range filter',
          query: () =>
            supabase
              .from('audit_logs')
              .select('*')
              .eq('organization_id', testOrgId)
              .gte(
                'created_at',
                new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
              )
              .limit(100),
        },
        {
          name: 'User filter',
          query: () =>
            supabase
              .from('audit_logs')
              .select('*')
              .eq('organization_id', testOrgId)
              .eq('user_id', testUserId)
              .limit(100),
        },
        {
          name: 'Action filter',
          query: () =>
            supabase
              .from('audit_logs')
              .select('*')
              .eq('organization_id', testOrgId)
              .eq('action', 'create')
              .limit(100),
        },
        {
          name: 'Entity type filter',
          query: () =>
            supabase
              .from('audit_logs')
              .select('*')
              .eq('organization_id', testOrgId)
              .eq('entity_type', 'product')
              .limit(100),
        },
      ]

      for (const test of queryTests) {
        const startTime = Date.now()
        const { error } = await test.query()
        const endTime = Date.now()
        const duration = endTime - startTime

        expect(error).toBeNull()
        expect(duration).toBeLessThan(1000) // Under 1 second

        console.log(`Query performance - ${test.name}: ${duration}ms`)
      }
    })
  })
})
