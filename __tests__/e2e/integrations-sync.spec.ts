import { test, expect } from '@playwright/test'
import { loginUser } from '../helpers/auth'

test.describe('Integration Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, 'test@truthsource.io')
  })

  test.describe('Platform Connections', () => {
    test('should connect to Shopify with OAuth flow', async ({ page }) => {
      await page.goto('/integrations')
      
      // Find Shopify integration
      const shopifyCard = page.locator('[data-testid="integration-card"]').filter({ hasText: 'Shopify' })
      await shopifyCard.locator('[data-testid="connect-btn"]').click()
      
      // Fill store URL
      await page.fill('[data-testid="store-url"]', 'truthsource-test.myshopify.com')
      await page.click('[data-testid="continue-auth"]')
      
      // Mock OAuth flow (in real test would handle redirect)
      await page.waitForURL(/callback/)
      
      // Should show connected status
      await expect(page).toHaveURL('/integrations')
      await expect(shopifyCard.locator('[data-testid="status-connected"]')).toBeVisible()
      await expect(shopifyCard.locator('[data-testid="last-sync"]')).toBeVisible()
    })

    test('should configure NetSuite connection with credentials', async ({ page }) => {
      await page.goto('/integrations')
      
      // Find NetSuite integration
      const netsuiteCard = page.locator('[data-testid="integration-card"]').filter({ hasText: 'NetSuite' })
      await netsuiteCard.locator('[data-testid="configure-btn"]').click()
      
      // Fill credentials
      await page.fill('[data-testid="account-id"]', 'TSTDRV1234567')
      await page.fill('[data-testid="consumer-key"]', 'test-consumer-key')
      await page.fill('[data-testid="consumer-secret"]', 'test-consumer-secret')
      await page.fill('[data-testid="token-id"]', 'test-token-id')
      await page.fill('[data-testid="token-secret"]', 'test-token-secret')
      
      // Test connection
      await page.click('[data-testid="test-connection"]')
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Testing...')
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 })
      
      // Save configuration
      await page.click('[data-testid="save-configuration"]')
      await expect(page.getByText('NetSuite connected successfully')).toBeVisible()
    })

    test('should manage field mappings between systems', async ({ page }) => {
      await page.goto('/integrations/shopify')
      
      // Go to field mappings
      await page.click('[data-testid="field-mappings-tab"]')
      
      // Should show default mappings
      await expect(page.locator('[data-testid="mapping-table"]')).toBeVisible()
      
      // Edit a mapping
      const skuMapping = page.locator('[data-testid="mapping-row"]').filter({ hasText: 'SKU' })
      await skuMapping.locator('[data-testid="edit-mapping"]').click()
      
      // Change Shopify field
      await page.selectOption('[data-testid="shopify-field"]', 'variant.sku')
      await page.fill('[data-testid="transformation"]', 'value.toUpperCase()')
      
      // Add custom mapping
      await page.click('[data-testid="add-mapping"]')
      await page.selectOption('[data-testid="truthsource-field-new"]', 'custom_field_1')
      await page.selectOption('[data-testid="shopify-field-new"]', 'metafield.custom.field1')
      
      // Save mappings
      await page.click('[data-testid="save-mappings"]')
      await expect(page.getByText('Mappings updated')).toBeVisible()
      
      // Test mappings
      await page.click('[data-testid="test-mappings"]')
      await expect(page.locator('[data-testid="mapping-test-results"]')).toBeVisible()
      await expect(page.getByText('All mappings valid')).toBeVisible()
    })
  })

  test.describe('Synchronization Engine', () => {
    test('should perform initial full sync with progress tracking', async ({ page }) => {
      await page.goto('/sync')
      
      // Start full sync
      await page.click('[data-testid="sync-actions"]')
      await page.click('[data-testid="full-sync"]')
      
      // Confirm dialog
      await expect(page.locator('[data-testid="sync-confirm-dialog"]')).toBeVisible()
      await expect(page.getByText('This will sync all data')).toBeVisible()
      await page.click('[data-testid="confirm-sync"]')
      
      // Should show real progress
      await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible()
      await expect(page.locator('[data-testid="sync-stage"]')).toContainText('Fetching products...')
      
      // Progress should update
      await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', /[1-9]/, { timeout: 5000 })
      
      // Should show item counts
      await expect(page.locator('[data-testid="products-synced"]')).toContainText(/\d+/)
      await expect(page.locator('[data-testid="inventory-synced"]')).toContainText(/\d+/)
      await expect(page.locator('[data-testid="orders-synced"]')).toContainText(/\d+/)
      
      // Should complete
      await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible({ timeout: 60000 })
      await expect(page.getByText('Sync completed successfully')).toBeVisible()
      
      // Should show summary
      await expect(page.locator('[data-testid="sync-summary"]')).toBeVisible()
      await expect(page.getByText('Items created:')).toBeVisible()
      await expect(page.getByText('Items updated:')).toBeVisible()
      await expect(page.getByText('Errors:')).toBeVisible()
    })

    test('should handle incremental syncs efficiently', async ({ page }) => {
      await page.goto('/sync')
      
      // Should show last sync time
      await expect(page.locator('[data-testid="last-sync-time"]')).toBeVisible()
      
      // Trigger incremental sync
      await page.click('[data-testid="sync-now"]')
      
      // Should only sync changes
      await expect(page.locator('[data-testid="sync-mode"]')).toContainText('Incremental')
      await expect(page.locator('[data-testid="changes-detected"]')).toBeVisible()
      
      // Should be faster than full sync
      await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible({ timeout: 10000 })
    })

    test('should create and manage sync schedules', async ({ page }) => {
      await page.goto('/sync/schedules')
      
      // Create new schedule
      await page.click('[data-testid="create-schedule"]')
      
      // Configure schedule
      await page.fill('[data-testid="schedule-name"]', 'Hourly Inventory Sync')
      await page.selectOption('[data-testid="sync-type"]', 'inventory')
      await page.selectOption('[data-testid="frequency"]', 'hourly')
      await page.selectOption('[data-testid="integration"]', 'all')
      
      // Set active hours
      await page.check('[data-testid="business-hours-only"]')
      await page.fill('[data-testid="start-hour"]', '08:00')
      await page.fill('[data-testid="end-hour"]', '18:00')
      
      // Enable
      await page.check('[data-testid="schedule-enabled"]')
      await page.click('[data-testid="save-schedule"]')
      
      // Should appear in list
      await expect(page.locator('[data-testid="schedule-row"]').filter({ hasText: 'Hourly Inventory Sync' })).toBeVisible()
      await expect(page.getByText('Next run:')).toBeVisible()
    })

    test('should detect and resolve sync conflicts', async ({ page }) => {
      await page.goto('/sync')
      
      // Simulate conflict (dev tool)
      await page.click('[data-testid="dev-tools"]')
      await page.click('[data-testid="create-sync-conflict"]')
      
      // Should show conflict alert
      await expect(page.locator('[data-testid="conflict-alert"]')).toBeVisible()
      await expect(page.getByText('3 conflicts detected')).toBeVisible()
      
      // View conflicts
      await page.click('[data-testid="view-conflicts"]')
      
      // Should show conflict details
      await expect(page.locator('[data-testid="conflict-table"]')).toBeVisible()
      
      // Resolve individual conflict
      const firstConflict = page.locator('[data-testid="conflict-row"]').first()
      await firstConflict.locator('[data-testid="resolve-conflict"]').click()
      
      // Should show both versions
      await expect(page.locator('[data-testid="local-version"]')).toBeVisible()
      await expect(page.locator('[data-testid="remote-version"]')).toBeVisible()
      await expect(page.locator('[data-testid="field-differences"]')).toBeVisible()
      
      // Choose resolution
      await page.click('[data-testid="use-remote"]')
      await page.click('[data-testid="apply-resolution"]')
      
      // Bulk resolve remaining
      await page.click('[data-testid="select-all-conflicts"]')
      await page.click('[data-testid="bulk-resolve"]')
      await page.selectOption('[data-testid="resolution-strategy"]', 'newest_wins')
      await page.click('[data-testid="apply-bulk-resolution"]')
      
      // Should resolve all conflicts
      await expect(page.getByText('All conflicts resolved')).toBeVisible()
      await expect(page.locator('[data-testid="conflict-alert"]')).not.toBeVisible()
    })
  })

  test.describe('Webhook Management', () => {
    test('should register and manage webhooks', async ({ page }) => {
      await page.goto('/integrations/shopify')
      
      // Go to webhooks tab
      await page.click('[data-testid="webhooks-tab"]')
      
      // Should show available webhooks
      await expect(page.locator('[data-testid="webhook-list"]')).toBeVisible()
      
      // Enable product update webhook
      const productWebhook = page.locator('[data-testid="webhook-row"]').filter({ hasText: 'products/update' })
      await productWebhook.locator('[data-testid="toggle-webhook"]').check()
      
      // Should register webhook
      await expect(page.getByText('Webhook registered')).toBeVisible()
      await expect(productWebhook.locator('[data-testid="webhook-status"]')).toContainText('Active')
      
      // View webhook details
      await productWebhook.locator('[data-testid="view-details"]').click()
      await expect(page.locator('[data-testid="webhook-url"]')).toBeVisible()
      await expect(page.locator('[data-testid="webhook-secret"]')).toBeVisible()
      
      // Test webhook
      await page.click('[data-testid="test-webhook"]')
      await expect(page.getByText('Test payload sent')).toBeVisible()
      await expect(page.locator('[data-testid="webhook-response"]')).toContainText('200 OK')
    })

    test('should monitor webhook activity and failures', async ({ page }) => {
      await page.goto('/integrations/webhooks')
      
      // Should show webhook activity
      await expect(page.locator('[data-testid="webhook-activity"]')).toBeVisible()
      await expect(page.locator('[data-testid="success-rate"]')).toBeVisible()
      await expect(page.locator('[data-testid="avg-response-time"]')).toBeVisible()
      
      // Filter by status
      await page.selectOption('[data-testid="status-filter"]', 'failed')
      
      // Should show failed webhooks
      const failedWebhook = page.locator('[data-testid="webhook-log-row"]').filter({ has: page.locator('[data-testid="status-failed"]') }).first()
      await failedWebhook.click()
      
      // Should show failure details
      await expect(page.locator('[data-testid="error-details"]')).toBeVisible()
      await expect(page.getByText('Response code:')).toBeVisible()
      await expect(page.getByText('Error message:')).toBeVisible()
      
      // Retry failed webhook
      await page.click('[data-testid="retry-webhook"]')
      await expect(page.getByText('Webhook requeued')).toBeVisible()
    })
  })

  test.describe('Data Accuracy Monitoring', () => {
    test('should track data accuracy metrics', async ({ page }) => {
      await page.goto('/monitoring')
      
      // Should show accuracy dashboard
      await expect(page.locator('[data-testid="accuracy-score"]')).toBeVisible()
      await expect(page.locator('[data-testid="accuracy-score"]')).toContainText('%')
      
      // Accuracy by data type
      await expect(page.locator('[data-testid="inventory-accuracy"]')).toBeVisible()
      await expect(page.locator('[data-testid="pricing-accuracy"]')).toBeVisible()
      await expect(page.locator('[data-testid="product-accuracy"]')).toBeVisible()
      
      // Discrepancy trends
      await expect(page.locator('[data-testid="discrepancy-chart"]')).toBeVisible()
      
      // Click for details
      await page.click('[data-testid="inventory-accuracy"]')
      
      // Should show detailed breakdown
      await expect(page.locator('[data-testid="accuracy-details"]')).toBeVisible()
      await expect(page.getByText('Discrepancies by warehouse')).toBeVisible()
      await expect(page.getByText('Common discrepancy types')).toBeVisible()
    })

    test('should alert on accuracy degradation', async ({ page }) => {
      await page.goto('/monitoring/alerts')
      
      // Should show active alerts
      await expect(page.locator('[data-testid="alert-list"]')).toBeVisible()
      
      // Find accuracy alert
      const accuracyAlert = page.locator('[data-testid="alert-row"]').filter({ hasText: 'Accuracy below threshold' })
      await expect(accuracyAlert).toBeVisible()
      await expect(accuracyAlert.locator('[data-testid="alert-severity-high"]')).toBeVisible()
      
      // View alert details
      await accuracyAlert.click()
      
      // Should show root cause analysis
      await expect(page.locator('[data-testid="alert-analysis"]')).toBeVisible()
      await expect(page.getByText('Potential causes:')).toBeVisible()
      await expect(page.getByText('Recommended actions:')).toBeVisible()
      
      // Take action
      await page.click('[data-testid="run-full-sync"]')
      await expect(page.getByText('Full sync initiated')).toBeVisible()
      
      // Acknowledge alert
      await page.click('[data-testid="acknowledge-alert"]')
      await page.fill('[data-testid="acknowledgment-notes"]', 'Running full sync to resolve discrepancies')
      await page.click('[data-testid="confirm-acknowledge"]')
      
      await expect(accuracyAlert.locator('[data-testid="alert-acknowledged"]')).toBeVisible()
    })
  })

  test.describe('Analytics and Reporting', () => {
    test('should generate sync performance reports', async ({ page }) => {
      await page.goto('/reports')
      
      // Create sync performance report
      await page.click('[data-testid="create-report"]')
      await page.selectOption('[data-testid="report-type"]', 'sync_performance')
      
      // Configure report
      await page.fill('[data-testid="report-name"]', 'Weekly Sync Performance')
      await page.selectOption('[data-testid="date-range"]', 'last_7_days')
      await page.check('[data-testid="include-errors"]')
      await page.check('[data-testid="include-conflicts"]')
      
      // Generate report
      await page.click('[data-testid="generate-report"]')
      
      // Should show report
      await expect(page.locator('[data-testid="report-viewer"]')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('Sync Success Rate')).toBeVisible()
      await expect(page.getByText('Average Sync Duration')).toBeVisible()
      await expect(page.getByText('Items Synced')).toBeVisible()
      
      // Export report
      await page.click('[data-testid="export-report"]')
      await page.selectOption('[data-testid="export-format"]', 'pdf')
      await page.click('[data-testid="download-report"]')
      
      const download = await page.waitForEvent('download')
      expect(download.suggestedFilename()).toMatch(/sync_performance_report_.*\.pdf/)
    })

    test('should track ROI and business impact', async ({ page }) => {
      await page.goto('/analytics')
      
      // ROI Dashboard
      await page.click('[data-testid="roi-tab"]')
      
      // Should show ROI metrics
      await expect(page.locator('[data-testid="error-reduction"]')).toBeVisible()
      await expect(page.locator('[data-testid="time-saved"]')).toBeVisible()
      await expect(page.locator('[data-testid="cost-savings"]')).toBeVisible()
      
      // Before/after comparison
      await expect(page.locator('[data-testid="before-after-chart"]')).toBeVisible()
      await expect(page.getByText('Order error rate')).toBeVisible()
      await expect(page.getByText('Manual corrections')).toBeVisible()
      
      // Drill down into specific metric
      await page.click('[data-testid="error-reduction"]')
      
      // Should show detailed breakdown
      await expect(page.locator('[data-testid="error-types-prevented"]')).toBeVisible()
      await expect(page.getByText('Inventory discrepancies')).toBeVisible()
      await expect(page.getByText('Pricing errors')).toBeVisible()
      await expect(page.getByText('Order fulfillment issues')).toBeVisible()
    })
  })
})