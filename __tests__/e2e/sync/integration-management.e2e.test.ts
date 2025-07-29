import { test, expect } from '@playwright/test'
import { setupE2ETest, cleanupE2ETest, loginAsTestUser } from '@/tests/helpers/e2e-helpers'

test.describe('Integration Management E2E Tests', () => {
  let testOrgId: string
  let testUserId: string

  test.beforeAll(async () => {
    const testData = await setupE2ETest()
    testOrgId = testData.organizationId
    testUserId = testData.userId
  })

  test.afterAll(async () => {
    await cleanupE2ETest()
  })

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, testUserId)
  })

  test.describe('Integration Dashboard', () => {
    test('should display integration overview', async ({ page }) => {
      await page.goto('/integrations')

      // Verify dashboard elements
      await expect(page.locator('h1')).toContainText('Integrations')
      await expect(page.locator('[data-testid="integration-stats"]')).toBeVisible()
      await expect(page.locator('[data-testid="active-integrations-count"]')).toBeVisible()
      await expect(page.locator('[data-testid="last-sync-time"]')).toBeVisible()

      // Verify integration cards
      const integrationCards = page.locator('[data-testid="integration-card"]')
      await expect(integrationCards).toHaveCount(await integrationCards.count())
    })

    test('should filter integrations by platform', async ({ page }) => {
      await page.goto('/integrations')

      // Filter by Shopify
      await page.click('[data-testid="platform-filter"]')
      await page.click('[data-testid="filter-shopify"]')

      // Verify filtered results
      const integrationCards = page.locator('[data-testid="integration-card"]')
      const count = await integrationCards.count()
      
      for (let i = 0; i < count; i++) {
        await expect(integrationCards.nth(i)).toContainText('Shopify')
      }

      // Clear filter
      await page.click('[data-testid="clear-filters-btn"]')
      await expect(integrationCards).toHaveCount(await integrationCards.count())
    })
  })

  test.describe('Integration Configuration', () => {
    test('should configure Shopify integration settings', async ({ page }) => {
      await page.goto('/integrations')

      // Click on Shopify integration
      await page.click('[data-testid="integration-card-shopify"]')
      await expect(page.locator('h1')).toContainText('Shopify Integration')

      // Update general settings
      await page.click('[data-testid="settings-tab"]')
      await page.fill('[name="sync_batch_size"]', '100')
      await page.selectOption('[name="conflict_resolution"]', 'manual')
      await page.click('[data-testid="enable-webhooks-checkbox"]')

      // Configure field mappings
      await page.click('[data-testid="field-mapping-tab"]')
      await page.selectOption('[data-testid="shopify-field-title"]', 'product_name')
      await page.selectOption('[data-testid="shopify-field-vendor"]', 'manufacturer')

      // Configure filters
      await page.click('[data-testid="filters-tab"]')
      await page.click('[data-testid="add-filter-btn"]')
      await page.selectOption('[name="filter_field"]', 'product_type')
      await page.selectOption('[name="filter_operator"]', 'equals')
      await page.fill('[name="filter_value"]', 'Electronics')

      // Save settings
      await page.click('[data-testid="save-settings-btn"]')
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Settings updated successfully'
      )
    })

    test('should test integration connection', async ({ page }) => {
      await page.goto('/integrations')
      await page.click('[data-testid="integration-card-shopify"]')

      // Test connection
      await page.click('[data-testid="test-connection-btn"]')
      await expect(page.locator('[data-testid="connection-test-spinner"]')).toBeVisible()

      // Wait for test result
      await expect(page.locator('[data-testid="connection-status"]')).toContainText(
        'Connected',
        { timeout: 10000 }
      )

      // Verify connection details
      await expect(page.locator('[data-testid="api-version"]')).toBeVisible()
      await expect(page.locator('[data-testid="store-info"]')).toBeVisible()
    })

    test('should configure webhook endpoints', async ({ page }) => {
      await page.goto('/integrations')
      await page.click('[data-testid="integration-card-shopify"]')
      await page.click('[data-testid="webhooks-tab"]')

      // View webhook URL
      await expect(page.locator('[data-testid="webhook-url"]')).toBeVisible()
      
      // Copy webhook URL
      await page.click('[data-testid="copy-webhook-url-btn"]')
      await expect(page.locator('[data-testid="copy-success-tooltip"]')).toContainText(
        'Copied!'
      )

      // Configure webhook events
      await page.click('[data-testid="configure-events-btn"]')
      await page.click('[data-testid="event-products-create"]')
      await page.click('[data-testid="event-products-update"]')
      await page.click('[data-testid="event-inventory-update"]')
      await page.click('[data-testid="save-events-btn"]')

      // Verify webhook registration
      await expect(page.locator('[data-testid="webhook-status"]')).toContainText(
        'Active'
      )
    })
  })

  test.describe('Integration Permissions', () => {
    test('should manage user access to integrations', async ({ page }) => {
      await page.goto('/integrations')
      await page.click('[data-testid="integration-card-netsuite"]')
      await page.click('[data-testid="permissions-tab"]')

      // Add user permission
      await page.click('[data-testid="add-user-permission-btn"]')
      await page.fill('[data-testid="user-email-input"]', 'team@example.com')
      await page.selectOption('[name="permission_level"]', 'read')
      await page.click('[data-testid="grant-permission-btn"]')

      // Verify permission added
      await expect(page.locator('[data-testid="permissions-list"]')).toContainText(
        'team@example.com'
      )

      // Update permission level
      await page.click('[data-testid="edit-permission-btn"]')
      await page.selectOption('[name="permission_level"]', 'admin')
      await page.click('[data-testid="update-permission-btn"]')

      // Verify update
      await expect(page.locator('[data-testid="permission-level-admin"]')).toBeVisible()
    })
  })

  test.describe('Integration Monitoring', () => {
    test('should view integration health metrics', async ({ page }) => {
      await page.goto('/integrations')
      await page.click('[data-testid="integration-card-shopify"]')
      await page.click('[data-testid="monitoring-tab"]')

      // Verify health metrics
      await expect(page.locator('[data-testid="uptime-percentage"]')).toBeVisible()
      await expect(page.locator('[data-testid="avg-response-time"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-rate"]')).toBeVisible()

      // View sync metrics chart
      await expect(page.locator('[data-testid="sync-metrics-chart"]')).toBeVisible()

      // Change time range
      await page.selectOption('[data-testid="time-range-select"]', '7d')
      await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible({
        timeout: 5000
      })
    })

    test('should view integration logs', async ({ page }) => {
      await page.goto('/integrations')
      await page.click('[data-testid="integration-card-shopify"]')
      await page.click('[data-testid="logs-tab"]')

      // Filter logs
      await page.selectOption('[data-testid="log-level-filter"]', 'error')
      await page.click('[data-testid="apply-log-filters-btn"]')

      // View log details
      const logEntry = page.locator('[data-testid="log-entry"]').first()
      if (await logEntry.isVisible()) {
        await logEntry.click()
        await expect(page.locator('[data-testid="log-details-modal"]')).toBeVisible()
        await expect(page.locator('[data-testid="log-timestamp"]')).toBeVisible()
        await expect(page.locator('[data-testid="log-message"]')).toBeVisible()
        await page.click('[data-testid="close-log-details-btn"]')
      }
    })
  })

  test.describe('Integration Troubleshooting', () => {
    test('should diagnose integration issues', async ({ page }) => {
      await page.goto('/integrations')
      await page.click('[data-testid="integration-card-shopify"]')
      await page.click('[data-testid="diagnostics-tab"]')

      // Run diagnostics
      await page.click('[data-testid="run-diagnostics-btn"]')
      await expect(page.locator('[data-testid="diagnostics-progress"]')).toBeVisible()

      // Wait for results
      await expect(page.locator('[data-testid="diagnostics-results"]')).toBeVisible({
        timeout: 15000
      })

      // Check diagnostic items
      const diagnosticItems = [
        'api-connectivity',
        'authentication',
        'permissions',
        'webhook-delivery',
        'data-format'
      ]

      for (const item of diagnosticItems) {
        const diagnostic = page.locator(`[data-testid="diagnostic-${item}"]`)
        if (await diagnostic.isVisible()) {
          await expect(diagnostic).toContainText(/Pass|Warning|Fail/)
        }
      }
    })

    test('should resolve common integration errors', async ({ page }) => {
      await page.goto('/integrations')

      // Find integration with error
      const errorCard = page.locator('[data-testid="integration-card-error"]').first()
      if (await errorCard.isVisible()) {
        await errorCard.click()

        // View error details
        await page.click('[data-testid="view-errors-btn"]')
        await expect(page.locator('[data-testid="error-list"]')).toBeVisible()

        // Apply suggested fix
        const fixButton = page.locator('[data-testid="apply-fix-btn"]').first()
        if (await fixButton.isVisible()) {
          await fixButton.click()
          await expect(page.locator('[data-testid="fix-progress"]')).toBeVisible()
          await expect(page.locator('[data-testid="fix-result"]')).toBeVisible({
            timeout: 10000
          })
        }
      }
    })
  })

  test.describe('Integration Backup and Recovery', () => {
    test('should backup integration configuration', async ({ page }) => {
      await page.goto('/integrations')
      await page.click('[data-testid="integration-card-shopify"]')
      await page.click('[data-testid="backup-tab"]')

      // Create backup
      await page.click('[data-testid="create-backup-btn"]')
      await page.fill('[name="backup_name"]', 'Test Backup ' + Date.now())
      await page.fill('[name="backup_description"]', 'E2E test backup')
      await page.click('[data-testid="confirm-backup-btn"]')

      // Verify backup created
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Backup created successfully'
      )

      // Download backup
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="download-backup-btn"]', { index: 0 })
      ])

      expect(download.suggestedFilename()).toContain('integration-backup')
      expect(download.suggestedFilename()).toContain('.json')
    })

    test('should restore integration from backup', async ({ page }) => {
      await page.goto('/integrations')
      await page.click('[data-testid="integration-card-shopify"]')
      await page.click('[data-testid="backup-tab"]')

      // Select backup to restore
      const backupRow = page.locator('[data-testid="backup-row"]').first()
      if (await backupRow.isVisible()) {
        await backupRow.locator('[data-testid="restore-backup-btn"]').click()

        // Confirm restoration
        await expect(page.locator('[data-testid="restore-dialog"]')).toContainText(
          'Restore this backup?'
        )
        await page.click('[data-testid="confirm-restore-btn"]')

        // Verify restoration
        await expect(page.locator('[data-testid="restore-progress"]')).toBeVisible()
        await expect(page.locator('[data-testid="success-toast"]')).toContainText(
          'Integration restored successfully',
          { timeout: 10000 }
        )
      }
    })
  })

  test.describe('Integration Migration', () => {
    test('should migrate from one platform to another', async ({ page }) => {
      await page.goto('/integrations/migrate')
      await expect(page.locator('h1')).toContainText('Integration Migration')

      // Select source integration
      await page.selectOption('[name="source_integration"]', { index: 1 })
      
      // Select target platform
      await page.selectOption('[name="target_platform"]', 'netsuite')

      // Configure migration settings
      await page.click('[data-testid="include-historical-data-checkbox"]')
      await page.fill('[name="historical_days"]', '30')
      await page.click('[data-testid="map-fields-automatically-checkbox"]')

      // Preview migration
      await page.click('[data-testid="preview-migration-btn"]')
      await expect(page.locator('[data-testid="migration-preview"]')).toBeVisible({
        timeout: 10000
      })

      // Review field mappings
      await expect(page.locator('[data-testid="field-mapping-preview"]')).toBeVisible()
      
      // Start migration
      await page.click('[data-testid="start-migration-btn"]')
      await expect(page.locator('[data-testid="migration-progress"]')).toBeVisible()

      // Monitor migration (this would be a long-running process)
      await expect(page.locator('[data-testid="migration-status"]')).toContainText(
        /In Progress|Completed/,
        { timeout: 60000 }
      )
    })
  })
})