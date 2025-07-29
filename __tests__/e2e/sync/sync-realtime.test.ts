import { test, expect, Page } from '@playwright/test'
import { createBrowserClient } from '@/lib/supabase/client'

// Helper to login before each test
async function loginAsTestUser(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', 'test@truthsource.com')
  await page.fill('[data-testid="password-input"]', 'TestPassword123!')
  await page.click('[data-testid="login-button"]')
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

// Helper to create a sync job via API
async function createSyncJob(organizationId: string, syncType: string) {
  const response = await fetch('/api/sync/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organization_id: organizationId,
      sync_type: syncType,
      source_system: 'netsuite',
      target_system: 'shopify',
    }),
  })
  return response.json()
}

test.describe('Sync Engine Real-time Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('should display real-time sync progress updates', async ({ page }) => {
    // Navigate to sync dashboard
    await page.goto('/sync')
    await page.waitForSelector('[data-testid="sync-dashboard"]')

    // Start a new sync
    await page.click('[data-testid="new-sync-button"]')
    await page.selectOption('[data-testid="sync-type-select"]', 'inventory')
    await page.click('[data-testid="start-sync-button"]')

    // Wait for sync to start
    await page.waitForSelector('[data-testid="sync-progress-bar"]')

    // Verify real-time progress updates
    const progressBar = page.locator('[data-testid="sync-progress-bar"]')
    const initialProgress = await progressBar.getAttribute('aria-valuenow')
    
    // Wait for progress to update
    await page.waitForTimeout(2000)
    
    const updatedProgress = await progressBar.getAttribute('aria-valuenow')
    expect(Number(updatedProgress)).toBeGreaterThan(Number(initialProgress))

    // Verify status updates
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('In Progress')
    
    // Verify record count updates
    const recordsProcessed = page.locator('[data-testid="records-processed"]')
    await expect(recordsProcessed).not.toHaveText('0')
  })

  test('should receive real-time conflict notifications', async ({ page, context }) => {
    // Open two tabs to simulate real-time updates
    const page2 = await context.newPage()
    await loginAsTestUser(page2)

    // Navigate both to sync dashboard
    await page.goto('/sync')
    await page2.goto('/sync')

    // Start sync in first tab
    await page.click('[data-testid="new-sync-button"]')
    await page.selectOption('[data-testid="sync-type-select"]', 'pricing')
    await page.click('[data-testid="start-sync-button"]')

    // Wait for conflict to appear in both tabs
    await page.waitForSelector('[data-testid="conflict-alert"]', { timeout: 30000 })
    await page2.waitForSelector('[data-testid="conflict-alert"]', { timeout: 30000 })

    // Verify conflict details
    const conflictAlert = page.locator('[data-testid="conflict-alert"]')
    await expect(conflictAlert).toContainText('Sync conflict detected')
    
    // Verify same conflict appears in second tab
    const conflictAlert2 = page2.locator('[data-testid="conflict-alert"]')
    await expect(conflictAlert2).toContainText('Sync conflict detected')

    // Close second page
    await page2.close()
  })

  test('should update inventory counts in real-time across pages', async ({ page, context }) => {
    // Navigate to inventory page
    await page.goto('/inventory')
    await page.waitForSelector('[data-testid="inventory-table"]')

    // Get initial inventory count for first product
    const firstProductQuantity = page.locator('[data-testid="inventory-quantity-0"]')
    const initialQuantity = await firstProductQuantity.textContent()

    // Open second tab and navigate to inventory
    const page2 = await context.newPage()
    await loginAsTestUser(page2)
    await page2.goto('/inventory')

    // Update inventory in second tab
    await page2.click('[data-testid="edit-inventory-0"]')
    await page2.fill('[data-testid="quantity-input"]', '500')
    await page2.click('[data-testid="save-inventory-button"]')

    // Verify real-time update in first tab
    await expect(firstProductQuantity).not.toHaveText(initialQuantity!)
    await expect(firstProductQuantity).toHaveText('500')

    // Verify update indicator
    await expect(page.locator('[data-testid="inventory-updated-indicator-0"]')).toBeVisible()

    await page2.close()
  })

  test('should handle concurrent sync operations', async ({ page }) => {
    await page.goto('/sync')

    // Start multiple sync operations
    const syncTypes = ['inventory', 'pricing', 'products']
    
    for (const syncType of syncTypes) {
      await page.click('[data-testid="new-sync-button"]')
      await page.selectOption('[data-testid="sync-type-select"]', syncType)
      await page.click('[data-testid="start-sync-button"]')
      await page.waitForTimeout(500) // Brief pause between syncs
    }

    // Verify all syncs are running
    const activeSync = page.locator('[data-testid="active-sync-item"]')
    await expect(activeSync).toHaveCount(3)

    // Verify each sync has its own progress
    for (let i = 0; i < 3; i++) {
      const syncProgress = page.locator(`[data-testid="sync-progress-${i}"]`)
      await expect(syncProgress).toBeVisible()
    }

    // Verify real-time updates for all syncs
    await page.waitForTimeout(3000)
    
    for (let i = 0; i < 3; i++) {
      const progressBar = page.locator(`[data-testid="sync-progress-bar-${i}"]`)
      const progress = await progressBar.getAttribute('aria-valuenow')
      expect(Number(progress)).toBeGreaterThan(0)
    }
  })

  test('should display real-time sync history updates', async ({ page, context }) => {
    // Open sync history page
    await page.goto('/sync/history')
    
    // Count initial history items
    const historyItems = page.locator('[data-testid="sync-history-item"]')
    const initialCount = await historyItems.count()

    // Open new tab and start a sync
    const page2 = await context.newPage()
    await loginAsTestUser(page2)
    await page2.goto('/sync')
    await page2.click('[data-testid="new-sync-button"]')
    await page2.selectOption('[data-testid="sync-type-select"]', 'customers')
    await page2.click('[data-testid="start-sync-button"]')

    // Verify new sync appears in history in real-time
    await expect(historyItems).toHaveCount(initialCount + 1)
    
    // Verify latest sync details
    const latestSync = page.locator('[data-testid="sync-history-item"]').first()
    await expect(latestSync).toContainText('customers')
    await expect(latestSync).toContainText('In Progress')

    // Wait for sync to complete and verify status update
    await page2.waitForSelector('[data-testid="sync-complete-message"]', { timeout: 60000 })
    
    // Verify status updated in history
    await expect(latestSync).toContainText('Completed')

    await page2.close()
  })

  test('should handle sync cancellation in real-time', async ({ page }) => {
    await page.goto('/sync')

    // Start a long-running sync
    await page.click('[data-testid="new-sync-button"]')
    await page.selectOption('[data-testid="sync-type-select"]', 'orders')
    await page.click('[data-testid="start-sync-button"]')

    // Wait for sync to start
    await page.waitForSelector('[data-testid="cancel-sync-button"]')

    // Cancel the sync
    await page.click('[data-testid="cancel-sync-button"]')
    await page.click('[data-testid="confirm-cancel-button"]')

    // Verify sync status updates to cancelled
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Cancelled')
    
    // Verify progress bar shows cancellation
    const progressBar = page.locator('[data-testid="sync-progress-bar"]')
    await expect(progressBar).toHaveAttribute('data-status', 'cancelled')

    // Verify cancel button is no longer visible
    await expect(page.locator('[data-testid="cancel-sync-button"]')).not.toBeVisible()
  })

  test('should display real-time error notifications', async ({ page }) => {
    await page.goto('/sync')

    // Trigger a sync that will fail (using special test endpoint)
    await page.click('[data-testid="new-sync-button"]')
    await page.selectOption('[data-testid="sync-type-select"]', 'test-error')
    await page.click('[data-testid="start-sync-button"]')

    // Wait for error notification
    await page.waitForSelector('[data-testid="sync-error-notification"]')
    
    // Verify error details
    const errorNotification = page.locator('[data-testid="sync-error-notification"]')
    await expect(errorNotification).toContainText('Sync failed')
    await expect(errorNotification).toHaveAttribute('data-severity', 'error')

    // Verify sync status
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Failed')

    // Verify retry button appears
    await expect(page.locator('[data-testid="retry-sync-button"]')).toBeVisible()
  })

  test('should update conflict resolution in real-time', async ({ page, context }) => {
    // Create a sync with conflicts
    await page.goto('/sync/conflicts')
    
    // Verify conflict exists
    await page.waitForSelector('[data-testid="conflict-item"]')
    const conflictItem = page.locator('[data-testid="conflict-item"]').first()
    
    // Open second tab to same page
    const page2 = await context.newPage()
    await loginAsTestUser(page2)
    await page2.goto('/sync/conflicts')

    // Resolve conflict in first tab
    await conflictItem.click()
    await page.click('[data-testid="use-source-value-button"]')
    await page.click('[data-testid="apply-resolution-button"]')

    // Verify resolution appears in second tab
    const conflictItem2 = page2.locator('[data-testid="conflict-item"]').first()
    await expect(conflictItem2).toHaveAttribute('data-resolved', 'true')
    await expect(conflictItem2).toContainText('Resolved')

    await page2.close()
  })

  test('should display real-time sync metrics', async ({ page }) => {
    await page.goto('/sync/dashboard')

    // Get initial metrics
    const totalSyncs = page.locator('[data-testid="total-syncs-metric"]')
    const successRate = page.locator('[data-testid="success-rate-metric"]')
    const avgDuration = page.locator('[data-testid="avg-duration-metric"]')

    const initialTotal = await totalSyncs.textContent()
    const initialRate = await successRate.textContent()

    // Start a new sync
    await page.click('[data-testid="quick-sync-inventory"]')

    // Wait for metrics to update
    await page.waitForTimeout(2000)

    // Verify metrics updated
    const updatedTotal = await totalSyncs.textContent()
    expect(Number(updatedTotal)).toBeGreaterThan(Number(initialTotal))

    // Verify chart updates
    const syncChart = page.locator('[data-testid="sync-activity-chart"]')
    await expect(syncChart).toHaveAttribute('data-updated', 'true')
  })

  test('should handle WebSocket reconnection gracefully', async ({ page }) => {
    await page.goto('/sync')
    
    // Simulate network interruption
    await page.context().setOffline(true)
    
    // Wait for offline indicator
    await page.waitForSelector('[data-testid="offline-indicator"]')
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Offline')

    // Restore connection
    await page.context().setOffline(false)

    // Wait for reconnection
    await page.waitForSelector('[data-testid="online-indicator"]')
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected')

    // Verify real-time updates resume
    await page.click('[data-testid="new-sync-button"]')
    await page.selectOption('[data-testid="sync-type-select"]', 'inventory')
    await page.click('[data-testid="start-sync-button"]')

    // Verify progress updates work after reconnection
    await page.waitForSelector('[data-testid="sync-progress-bar"]')
    const progressBar = page.locator('[data-testid="sync-progress-bar"]')
    
    await page.waitForTimeout(2000)
    const progress = await progressBar.getAttribute('aria-valuenow')
    expect(Number(progress)).toBeGreaterThan(0)
  })
})