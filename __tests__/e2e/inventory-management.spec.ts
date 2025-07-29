import { test, expect } from '@playwright/test'
import { loginUser } from '../helpers/auth'

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, 'test@truthsource.io')
  })

  test.describe('Real-time Inventory Sync', () => {
    test('should automatically sync inventory changes across all connected systems', async ({ page }) => {
      await page.goto('/inventory')
      
      // When inventory is updated in TruthSource
      const firstItem = page.locator('[data-testid="inventory-row"]').first()
      await firstItem.locator('[data-testid="edit-quantity"]').click()
      await page.fill('[data-testid="quantity-input"]', '150')
      await page.click('[data-testid="save-quantity"]')
      
      // Then it should show sync in progress
      await expect(page.locator('[data-testid="sync-indicator"]')).toContainText('Syncing...')
      
      // And sync should complete successfully
      await expect(page.locator('[data-testid="sync-status"]')).toContainText('Synced', { timeout: 10000 })
      
      // And the change should be reflected in connected systems (verified by sync status)
      await expect(firstItem.locator('[data-testid="shopify-sync-status"]')).toHaveClass(/synced/)
      await expect(firstItem.locator('[data-testid="netsuite-sync-status"]')).toHaveClass(/synced/)
    })

    test('should handle sync conflicts intelligently', async ({ page }) => {
      // Simulate a conflict scenario
      await page.goto('/inventory')
      
      // When a conflict is detected
      await page.click('[data-testid="simulate-conflict"]') // Dev tool
      
      // Then conflict resolution dialog should appear
      await expect(page.locator('[data-testid="conflict-dialog"]')).toBeVisible()
      
      // And should show both values clearly
      await expect(page.locator('[data-testid="local-value"]')).toBeVisible()
      await expect(page.locator('[data-testid="external-value"]')).toBeVisible()
      
      // When user selects resolution
      await page.click('[data-testid="keep-external"]')
      await page.click('[data-testid="resolve-conflicts"]')
      
      // Then conflict should be resolved
      await expect(page.locator('[data-testid="conflict-dialog"]')).not.toBeVisible()
      await expect(page.getByText('Conflicts resolved successfully')).toBeVisible()
    })

    test('should queue changes when offline and sync when reconnected', async ({ page, context }) => {
      await page.goto('/inventory')
      
      // Go offline
      await context.setOffline(true)
      
      // Make changes while offline
      await page.click('[data-testid="edit-quantity"]')
      await page.fill('[data-testid="quantity-input"]', '200')
      await page.click('[data-testid="save-quantity"]')
      
      // Should show offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible()
      await expect(page.locator('[data-testid="offline-queue-count"]')).toContainText('1 pending')
      
      // Go back online
      await context.setOffline(false)
      
      // Should automatically sync queued changes
      await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Offline changes synced successfully')).toBeVisible()
    })
  })

  test.describe('Low Stock Alerts', () => {
    test('should automatically create alerts when inventory falls below reorder point', async ({ page }) => {
      await page.goto('/inventory')
      
      // Update quantity to below reorder point
      const product = page.locator('[data-testid="inventory-row"]').filter({ hasText: 'Widget A' })
      await product.locator('[data-testid="edit-quantity"]').click()
      await page.fill('[data-testid="quantity-input"]', '5') // Assuming reorder point is 10
      await page.click('[data-testid="save-quantity"]')
      
      // Alert should be created automatically
      await expect(page.locator('[data-testid="low-stock-badge"]')).toBeVisible()
      
      // Navigate to alerts
      await page.goto('/monitoring/alerts')
      await expect(page.getByText('Low Stock Alert - Widget A')).toBeVisible()
      await expect(page.getByText('Available quantity: 5')).toBeVisible()
    })

    test('should filter inventory by low stock status', async ({ page }) => {
      await page.goto('/inventory')
      
      // Apply low stock filter
      await page.click('[data-testid="filter-button"]')
      await page.check('[data-testid="low-stock-filter"]')
      await page.click('[data-testid="apply-filters"]')
      
      // Only low stock items should be visible
      const items = page.locator('[data-testid="inventory-row"]')
      const count = await items.count()
      
      for (let i = 0; i < count; i++) {
        await expect(items.nth(i).locator('[data-testid="low-stock-badge"]')).toBeVisible()
      }
    })
  })

  test.describe('Bulk Operations', () => {
    test('should allow bulk inventory updates with progress tracking', async ({ page }) => {
      await page.goto('/inventory')
      
      // Select multiple items
      await page.check('[data-testid="select-all"]')
      
      // Open bulk update dialog
      await page.click('[data-testid="bulk-actions"]')
      await page.click('[data-testid="bulk-update-quantity"]')
      
      // Set bulk update parameters
      await page.selectOption('[data-testid="bulk-operation"]', 'add')
      await page.fill('[data-testid="bulk-quantity"]', '50')
      await page.fill('[data-testid="bulk-reason"]', 'Received new shipment')
      
      // Execute bulk update
      await page.click('[data-testid="execute-bulk-update"]')
      
      // Should show real progress
      await expect(page.locator('[data-testid="bulk-progress"]')).toBeVisible()
      await expect(page.locator('[data-testid="progress-percentage"]')).toContainText('%')
      
      // Should complete successfully
      await expect(page.getByText('Bulk update completed successfully')).toBeVisible({ timeout: 30000 })
      await expect(page.locator('[data-testid="bulk-progress"]')).not.toBeVisible()
    })
  })

  test.describe('Inventory History', () => {
    test('should maintain complete audit trail of all changes', async ({ page }) => {
      await page.goto('/inventory')
      
      // Make a change
      const firstItem = page.locator('[data-testid="inventory-row"]').first()
      const originalQuantity = await firstItem.locator('[data-testid="quantity"]').textContent()
      
      await firstItem.locator('[data-testid="edit-quantity"]').click()
      await page.fill('[data-testid="quantity-input"]', '300')
      await page.fill('[data-testid="adjustment-reason"]', 'Cycle count adjustment')
      await page.click('[data-testid="save-quantity"]')
      
      // View history
      await firstItem.locator('[data-testid="view-history"]').click()
      
      // Should show the change with all details
      await expect(page.locator('[data-testid="history-dialog"]')).toBeVisible()
      await expect(page.getByText('Cycle count adjustment')).toBeVisible()
      await expect(page.getByText(`${originalQuantity} → 300`)).toBeVisible()
      await expect(page.getByText(new Date().toLocaleDateString())).toBeVisible()
    })
  })
})

test.describe('Warehouse Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, 'test@truthsource.io')
  })

  test('should enforce single default warehouse rule', async ({ page }) => {
    await page.goto('/warehouses')
    
    // Current default warehouse
    const currentDefault = page.locator('[data-testid="warehouse-row"]').filter({ has: page.locator('[data-testid="default-badge"]') })
    
    // Try to set another as default
    const anotherWarehouse = page.locator('[data-testid="warehouse-row"]').filter({ hasNot: page.locator('[data-testid="default-badge"]') }).first()
    await anotherWarehouse.locator('[data-testid="warehouse-menu"]').click()
    await page.click('[data-testid="set-as-default"]')
    
    // Confirm dialog should appear
    await expect(page.locator('[data-testid="confirm-dialog"]')).toContainText('This will remove default status from')
    await page.click('[data-testid="confirm-button"]')
    
    // New warehouse should be default
    await expect(anotherWarehouse.locator('[data-testid="default-badge"]')).toBeVisible()
    
    // Previous default should no longer be default
    await expect(currentDefault.locator('[data-testid="default-badge"]')).not.toBeVisible()
  })

  test('should show inventory breakdown by warehouse', async ({ page }) => {
    await page.goto('/warehouses')
    
    // Click on a warehouse
    await page.click('[data-testid="warehouse-row"]')
    
    // Should show inventory summary
    await expect(page.locator('[data-testid="total-skus"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-quantity"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-value"]')).toBeVisible()
    
    // Should show inventory breakdown
    await expect(page.locator('[data-testid="inventory-by-category"]')).toBeVisible()
    await expect(page.locator('[data-testid="low-stock-items"]')).toBeVisible()
  })
})

test.describe('Multi-warehouse Inventory', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, 'test@truthsource.io')
  })

  test('should display aggregated inventory across all warehouses', async ({ page }) => {
    await page.goto('/inventory')
    
    // Default view should show total across warehouses
    const firstItem = page.locator('[data-testid="inventory-row"]').first()
    await expect(firstItem.locator('[data-testid="total-quantity"]')).toBeVisible()
    await expect(firstItem.locator('[data-testid="warehouse-breakdown"]')).toBeVisible()
    
    // Hover for breakdown
    await firstItem.locator('[data-testid="warehouse-breakdown"]').hover()
    await expect(page.locator('[data-testid="warehouse-tooltip"]')).toBeVisible()
    await expect(page.locator('[data-testid="warehouse-tooltip"]')).toContainText('Main Warehouse:')
    await expect(page.locator('[data-testid="warehouse-tooltip"]')).toContainText('Secondary Warehouse:')
  })

  test('should allow filtering by specific warehouse', async ({ page }) => {
    await page.goto('/inventory')
    
    // Open warehouse filter
    await page.click('[data-testid="warehouse-filter"]')
    await page.click('[data-testid="warehouse-option-main"]')
    
    // Should only show inventory for selected warehouse
    const items = page.locator('[data-testid="inventory-row"]')
    const count = await items.count()
    
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i).locator('[data-testid="warehouse-name"]')).toContainText('Main Warehouse')
    }
  })

  test('should handle inter-warehouse transfers', async ({ page }) => {
    await page.goto('/inventory')
    
    // Initiate transfer
    const product = page.locator('[data-testid="inventory-row"]').first()
    await product.locator('[data-testid="actions-menu"]').click()
    await page.click('[data-testid="transfer-stock"]')
    
    // Fill transfer form
    await page.selectOption('[data-testid="from-warehouse"]', 'main-warehouse')
    await page.selectOption('[data-testid="to-warehouse"]', 'secondary-warehouse')
    await page.fill('[data-testid="transfer-quantity"]', '25')
    await page.fill('[data-testid="transfer-reason"]', 'Balancing inventory levels')
    
    // Execute transfer
    await page.click('[data-testid="execute-transfer"]')
    
    // Should show success and update quantities
    await expect(page.getByText('Transfer completed successfully')).toBeVisible()
    
    // Verify quantities updated
    await product.locator('[data-testid="warehouse-breakdown"]').click()
    await expect(page.getByText('Main Warehouse: 75')).toBeVisible() // Assuming started with 100
    await expect(page.getByText('Secondary Warehouse: 25')).toBeVisible()
  })
})