import { test, expect } from '@playwright/test'
import { setupE2ETest, cleanupE2ETest, loginAsTestUser } from '@/tests/helpers/e2e-helpers'

test.describe('Sync Workflow E2E Tests', () => {
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

  test.describe('Integration Setup', () => {
    test('should set up a new Shopify integration', async ({ page }) => {
      // Navigate to integrations page
      await page.goto('/integrations')
      await expect(page.locator('h1')).toContainText('Integrations')

      // Click add integration button
      await page.click('[data-testid="add-integration-btn"]')
      await expect(page.locator('h2')).toContainText('Add Integration')

      // Select Shopify
      await page.click('[data-testid="platform-shopify"]')
      await page.click('[data-testid="continue-btn"]')

      // Fill in Shopify credentials
      await page.fill('[name="store_url"]', 'test-store.myshopify.com')
      await page.fill('[name="api_key"]', 'test-api-key-123')
      await page.fill('[name="api_secret"]', 'test-api-secret-456')
      await page.fill('[name="access_token"]', 'test-access-token-789')

      // Configure sync settings
      await page.click('[data-testid="sync-inventory-checkbox"]')
      await page.click('[data-testid="sync-pricing-checkbox"]')
      await page.selectOption('[name="sync_interval"]', 'hourly')

      // Save integration
      await page.click('[data-testid="save-integration-btn"]')

      // Verify success message
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Integration added successfully'
      )

      // Verify integration appears in list
      await expect(page.locator('[data-testid="integration-list"]')).toContainText(
        'test-store.myshopify.com'
      )
    })

    test('should set up a NetSuite integration', async ({ page }) => {
      await page.goto('/integrations')
      await page.click('[data-testid="add-integration-btn"]')

      // Select NetSuite
      await page.click('[data-testid="platform-netsuite"]')
      await page.click('[data-testid="continue-btn"]')

      // Fill in NetSuite credentials
      await page.fill('[name="account_id"]', '123456')
      await page.fill('[name="consumer_key"]', 'test-consumer-key')
      await page.fill('[name="consumer_secret"]', 'test-consumer-secret')
      await page.fill('[name="token_id"]', 'test-token-id')
      await page.fill('[name="token_secret"]', 'test-token-secret')

      // Save integration
      await page.click('[data-testid="save-integration-btn"]')

      // Verify success
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Integration added successfully'
      )
    })
  })

  test.describe('Manual Sync Operations', () => {
    test('should perform manual inventory sync', async ({ page }) => {
      // Navigate to sync page
      await page.goto('/sync')
      await expect(page.locator('h1')).toContainText('Data Sync')

      // Select integration
      await page.click('[data-testid="integration-select"]')
      await page.click('[data-testid="integration-option-shopify"]')

      // Select sync type
      await page.click('[data-testid="sync-type-inventory"]')

      // Start sync
      await page.click('[data-testid="start-sync-btn"]')

      // Wait for sync to start
      await expect(page.locator('[data-testid="sync-status"]')).toContainText(
        'In Progress'
      )

      // Wait for sync to complete (with timeout)
      await expect(page.locator('[data-testid="sync-status"]')).toContainText(
        'Completed',
        { timeout: 30000 }
      )

      // Verify sync results
      await expect(page.locator('[data-testid="sync-summary"]')).toContainText(
        'Records synced'
      )
      await expect(page.locator('[data-testid="records-synced-count"]')).not.toContainText('0')
    })

    test('should handle sync conflicts', async ({ page }) => {
      // Create conflicting data scenario
      await page.goto('/inventory')
      await page.click('[data-testid="edit-inventory-btn"]')
      await page.fill('[name="quantity"]', '100')
      await page.click('[data-testid="save-btn"]')

      // Perform sync that will create conflict
      await page.goto('/sync')
      await page.click('[data-testid="integration-select"]')
      await page.click('[data-testid="integration-option-shopify"]')
      await page.click('[data-testid="sync-type-inventory"]')
      await page.click('[data-testid="start-sync-btn"]')

      // Wait for conflict detection
      await expect(page.locator('[data-testid="conflict-alert"]')).toBeVisible({
        timeout: 10000
      })

      // Review conflicts
      await page.click('[data-testid="review-conflicts-btn"]')
      await expect(page.locator('h2')).toContainText('Sync Conflicts')

      // Resolve conflict
      await page.click('[data-testid="conflict-resolution-external"]')
      await page.click('[data-testid="apply-resolution-btn"]')

      // Verify resolution
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Conflicts resolved'
      )
    })
  })

  test.describe('Scheduled Sync', () => {
    test('should configure scheduled sync', async ({ page }) => {
      await page.goto('/sync/schedule')
      await expect(page.locator('h1')).toContainText('Sync Schedule')

      // Add new schedule
      await page.click('[data-testid="add-schedule-btn"]')

      // Configure schedule
      await page.selectOption('[name="integration_id"]', { index: 1 })
      await page.selectOption('[name="sync_type"]', 'inventory')
      await page.selectOption('[name="interval"]', 'daily')
      await page.fill('[name="time"]', '09:00')
      await page.selectOption('[name="timezone"]', 'America/New_York')

      // Enable notifications
      await page.click('[data-testid="enable-notifications-checkbox"]')
      await page.fill('[name="notification_email"]', 'test@example.com')

      // Save schedule
      await page.click('[data-testid="save-schedule-btn"]')

      // Verify schedule created
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Schedule created successfully'
      )

      // Verify schedule appears in list
      await expect(page.locator('[data-testid="schedule-list"]')).toContainText(
        'Daily at 9:00 AM'
      )
    })

    test('should pause and resume scheduled sync', async ({ page }) => {
      await page.goto('/sync/schedule')

      // Find active schedule
      const scheduleRow = page.locator('[data-testid="schedule-row"]').first()
      await expect(scheduleRow).toContainText('Active')

      // Pause schedule
      await scheduleRow.locator('[data-testid="pause-schedule-btn"]').click()
      await expect(page.locator('[data-testid="confirm-dialog"]')).toContainText(
        'Pause this sync schedule?'
      )
      await page.click('[data-testid="confirm-btn"]')

      // Verify paused
      await expect(scheduleRow).toContainText('Paused')

      // Resume schedule
      await scheduleRow.locator('[data-testid="resume-schedule-btn"]').click()
      await expect(scheduleRow).toContainText('Active')
    })
  })

  test.describe('Sync History and Monitoring', () => {
    test('should view sync history and details', async ({ page }) => {
      await page.goto('/sync/history')
      await expect(page.locator('h1')).toContainText('Sync History')

      // Filter by date range
      await page.fill('[data-testid="date-from"]', '2024-01-01')
      await page.fill('[data-testid="date-to"]', '2024-12-31')
      await page.click('[data-testid="apply-filters-btn"]')

      // Click on a sync log
      await page.click('[data-testid="sync-log-row"]', { index: 0 })

      // View sync details
      await expect(page.locator('h2')).toContainText('Sync Details')
      await expect(page.locator('[data-testid="sync-id"]')).toBeVisible()
      await expect(page.locator('[data-testid="sync-duration"]')).toBeVisible()
      await expect(page.locator('[data-testid="records-synced"]')).toBeVisible()

      // View sync errors if any
      const errorsTab = page.locator('[data-testid="errors-tab"]')
      if (await errorsTab.isVisible()) {
        await errorsTab.click()
        await expect(page.locator('[data-testid="error-list"]')).toBeVisible()
      }
    })

    test('should export sync report', async ({ page }) => {
      await page.goto('/sync/history')

      // Select date range
      await page.fill('[data-testid="date-from"]', '2024-01-01')
      await page.fill('[data-testid="date-to"]', '2024-01-31')

      // Export report
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-report-btn"]')
      ])

      // Verify download
      expect(download.suggestedFilename()).toContain('sync-report')
      expect(download.suggestedFilename()).toContain('.csv')
    })
  })

  test.describe('Real-time Sync Updates', () => {
    test('should show real-time sync progress', async ({ page, context }) => {
      // Open sync page in first tab
      await page.goto('/sync')

      // Open monitoring page in second tab
      const monitorPage = await context.newPage()
      await loginAsTestUser(monitorPage, testUserId)
      await monitorPage.goto('/sync/monitor')

      // Start sync in first tab
      await page.click('[data-testid="integration-select"]')
      await page.click('[data-testid="integration-option-shopify"]')
      await page.click('[data-testid="sync-type-inventory"]')
      await page.click('[data-testid="start-sync-btn"]')

      // Verify real-time updates in monitor tab
      await expect(monitorPage.locator('[data-testid="active-sync-card"]')).toBeVisible({
        timeout: 5000
      })
      await expect(monitorPage.locator('[data-testid="sync-progress-bar"]')).toBeVisible()

      // Wait for completion
      await expect(monitorPage.locator('[data-testid="sync-status"]')).toContainText(
        'Completed',
        { timeout: 30000 }
      )

      // Close monitor page
      await monitorPage.close()
    })
  })

  test.describe('Error Handling and Recovery', () => {
    test('should handle API connection errors', async ({ page }) => {
      // Simulate API error by using invalid credentials
      await page.goto('/integrations')
      await page.click('[data-testid="edit-integration-btn"]', { index: 0 })
      await page.fill('[name="api_key"]', 'invalid-key')
      await page.click('[data-testid="save-btn"]')

      // Try to sync
      await page.goto('/sync')
      await page.click('[data-testid="integration-select"]')
      await page.click('[data-testid="integration-option-shopify"]')
      await page.click('[data-testid="sync-type-inventory"]')
      await page.click('[data-testid="start-sync-btn"]')

      // Verify error message
      await expect(page.locator('[data-testid="error-alert"]')).toContainText(
        'Authentication failed'
      )

      // Fix credentials
      await page.click('[data-testid="fix-integration-link"]')
      await page.fill('[name="api_key"]', 'test-api-key-123')
      await page.click('[data-testid="save-btn"]')

      // Retry sync
      await page.goto('/sync')
      await page.click('[data-testid="retry-sync-btn"]')

      // Verify success
      await expect(page.locator('[data-testid="sync-status"]')).toContainText(
        'Completed',
        { timeout: 30000 }
      )
    })

    test('should handle partial sync failures', async ({ page }) => {
      await page.goto('/sync')

      // Start a large sync that may have partial failures
      await page.click('[data-testid="integration-select"]')
      await page.click('[data-testid="integration-option-netsuite"]')
      await page.click('[data-testid="sync-type-all"]')
      await page.click('[data-testid="start-sync-btn"]')

      // Wait for completion
      await expect(page.locator('[data-testid="sync-status"]')).toContainText(
        'Completed with errors',
        { timeout: 60000 }
      )

      // Review failed records
      await page.click('[data-testid="view-errors-btn"]')
      await expect(page.locator('h2')).toContainText('Sync Errors')

      // Retry failed records
      await page.click('[data-testid="select-all-checkbox"]')
      await page.click('[data-testid="retry-selected-btn"]')

      // Verify retry attempt
      await expect(page.locator('[data-testid="retry-progress"]')).toBeVisible()
    })
  })
})