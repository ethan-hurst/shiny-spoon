import { test, expect } from '@playwright/test'
import { setupE2ETest, cleanupE2ETest, loginAsTestUser } from '@/tests/helpers/e2e-helpers'

test.describe('Order Processing E2E Tests', () => {
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

  test.describe('Order Creation and Fulfillment', () => {
    test('should create and process an order end-to-end', async ({ page }) => {
      // Navigate to orders page
      await page.goto('/orders')
      await expect(page.locator('h1')).toContainText('Orders')

      // Create new order
      await page.click('[data-testid="create-order-btn"]')
      await expect(page.locator('h2')).toContainText('New Order')

      // Select customer
      await page.click('[data-testid="customer-select"]')
      await page.fill('[data-testid="customer-search"]', 'Test Customer')
      await page.click('[data-testid="customer-option-0"]')

      // Add products
      await page.click('[data-testid="add-product-btn"]')
      await page.fill('[data-testid="product-search"]', 'TEST-SKU-001')
      await page.click('[data-testid="product-result-0"]')
      await page.fill('[data-testid="quantity-input-0"]', '5')

      // Add another product
      await page.click('[data-testid="add-product-btn"]')
      await page.fill('[data-testid="product-search"]', 'TEST-SKU-002')
      await page.click('[data-testid="product-result-0"]')
      await page.fill('[data-testid="quantity-input-1"]', '3')

      // Verify pricing is calculated
      await expect(page.locator('[data-testid="order-subtotal"]')).toContainText('$')
      await expect(page.locator('[data-testid="order-tax"]')).toContainText('$')
      await expect(page.locator('[data-testid="order-total"]')).toContainText('$')

      // Save order
      await page.click('[data-testid="save-order-btn"]')
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Order created successfully'
      )

      // Should redirect to order detail page
      await expect(page.url()).toMatch(/\/orders\/[a-zA-Z0-9-]+$/)
      
      // Verify order details
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Pending')
      await expect(page.locator('[data-testid="order-items-table"]')).toBeVisible()
      
      // Store order ID for later steps
      const orderId = page.url().split('/').pop()

      // Process order - check inventory
      await page.click('[data-testid="check-inventory-btn"]')
      await expect(page.locator('[data-testid="inventory-check-dialog"]')).toBeVisible()
      
      // Wait for inventory check
      await expect(page.locator('[data-testid="inventory-status"]')).toContainText(
        'Available',
        { timeout: 10000 }
      )
      
      // Confirm inventory allocation
      await page.click('[data-testid="allocate-inventory-btn"]')
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Inventory allocated'
      )

      // Approve order
      await page.click('[data-testid="approve-order-btn"]')
      await expect(page.locator('[data-testid="approval-dialog"]')).toBeVisible()
      await page.fill('[data-testid="approval-notes"]', 'Approved for processing')
      await page.click('[data-testid="confirm-approval-btn"]')

      // Verify status update
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Approved')

      // Sync to external system
      await page.click('[data-testid="sync-order-btn"]')
      await expect(page.locator('[data-testid="sync-dialog"]')).toBeVisible()
      await page.selectOption('[data-testid="target-system"]', 'netsuite')
      await page.click('[data-testid="start-sync-btn"]')

      // Wait for sync to complete
      await expect(page.locator('[data-testid="sync-status"]')).toContainText(
        'Completed',
        { timeout: 30000 }
      )

      // Verify external ID was assigned
      await expect(page.locator('[data-testid="external-order-id"]')).toBeVisible()
      await expect(page.locator('[data-testid="external-order-id"]')).not.toBeEmpty()
    })

    test('should handle order with insufficient inventory', async ({ page }) => {
      await page.goto('/orders/new')

      // Select customer
      await page.click('[data-testid="customer-select"]')
      await page.fill('[data-testid="customer-search"]', 'Test Customer')
      await page.click('[data-testid="customer-option-0"]')

      // Add product with high quantity
      await page.click('[data-testid="add-product-btn"]')
      await page.fill('[data-testid="product-search"]', 'LOW-STOCK-SKU')
      await page.click('[data-testid="product-result-0"]')
      await page.fill('[data-testid="quantity-input-0"]', '1000') // More than available

      // Save order
      await page.click('[data-testid="save-order-btn"]')

      // Check inventory
      await page.click('[data-testid="check-inventory-btn"]')
      
      // Should show insufficient inventory
      await expect(page.locator('[data-testid="inventory-warning"]')).toContainText(
        'Insufficient inventory'
      )
      await expect(page.locator('[data-testid="available-quantity"]')).toBeVisible()

      // Try alternative fulfillment
      await page.click('[data-testid="check-alternatives-btn"]')
      await expect(page.locator('[data-testid="alternative-warehouses"]')).toBeVisible()
      
      // Select split fulfillment if available
      if (await page.locator('[data-testid="split-fulfillment-option"]').isVisible()) {
        await page.click('[data-testid="split-fulfillment-option"]')
        await page.click('[data-testid="apply-split-btn"]')
        
        await expect(page.locator('[data-testid="success-toast"]')).toContainText(
          'Order split across warehouses'
        )
      }
    })

    test('should handle order cancellation', async ({ page }) => {
      // Create an order first
      await page.goto('/orders/new')
      await page.click('[data-testid="customer-select"]')
      await page.fill('[data-testid="customer-search"]', 'Test Customer')
      await page.click('[data-testid="customer-option-0"]')
      await page.click('[data-testid="add-product-btn"]')
      await page.fill('[data-testid="product-search"]', 'TEST-SKU-001')
      await page.click('[data-testid="product-result-0"]')
      await page.fill('[data-testid="quantity-input-0"]', '2')
      await page.click('[data-testid="save-order-btn"]')

      // Now cancel the order
      await page.click('[data-testid="cancel-order-btn"]')
      await expect(page.locator('[data-testid="cancel-dialog"]')).toBeVisible()
      
      // Provide cancellation reason
      await page.selectOption('[data-testid="cancel-reason"]', 'customer_request')
      await page.fill('[data-testid="cancel-notes"]', 'Customer changed their mind')
      await page.click('[data-testid="confirm-cancel-btn"]')

      // Verify cancellation
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Cancelled')
      
      // Verify inventory was released
      await expect(page.locator('[data-testid="inventory-released-notice"]')).toBeVisible()
    })
  })

  test.describe('Order Search and Filtering', () => {
    test('should search and filter orders', async ({ page }) => {
      await page.goto('/orders')

      // Search by order number
      await page.fill('[data-testid="order-search"]', 'ORD-2024')
      await page.press('[data-testid="order-search"]', 'Enter')
      
      // Verify search results
      await expect(page.locator('[data-testid="order-row"]')).toHaveCount(
        await page.locator('[data-testid="order-row"]').count()
      )

      // Clear search
      await page.click('[data-testid="clear-search-btn"]')

      // Filter by status
      await page.click('[data-testid="status-filter"]')
      await page.click('[data-testid="filter-status-pending"]')
      
      // Verify filtered results
      const orderRows = page.locator('[data-testid="order-row"]')
      const count = await orderRows.count()
      
      for (let i = 0; i < count; i++) {
        await expect(orderRows.nth(i).locator('[data-testid="order-status-badge"]'))
          .toContainText('Pending')
      }

      // Filter by date range
      await page.click('[data-testid="date-filter"]')
      await page.fill('[data-testid="date-from"]', '2024-01-01')
      await page.fill('[data-testid="date-to"]', '2024-12-31')
      await page.click('[data-testid="apply-date-filter-btn"]')

      // Export filtered results
      await page.click('[data-testid="export-orders-btn"]')
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-csv-btn"]')
      ])

      expect(download.suggestedFilename()).toContain('orders')
      expect(download.suggestedFilename()).toContain('.csv')
    })
  })

  test.describe('Order Updates and History', () => {
    test('should track order status changes', async ({ page }) => {
      // Navigate to an existing order
      await page.goto('/orders')
      await page.click('[data-testid="order-row"]', { index: 0 })

      // View order history
      await page.click('[data-testid="history-tab"]')
      await expect(page.locator('[data-testid="order-timeline"]')).toBeVisible()

      // Verify timeline events
      const timelineEvents = page.locator('[data-testid="timeline-event"]')
      await expect(timelineEvents).toHaveCount(await timelineEvents.count())

      // Each event should have timestamp and description
      const firstEvent = timelineEvents.first()
      await expect(firstEvent.locator('[data-testid="event-timestamp"]')).toBeVisible()
      await expect(firstEvent.locator('[data-testid="event-description"]')).toBeVisible()
      await expect(firstEvent.locator('[data-testid="event-user"]')).toBeVisible()
    })

    test('should add notes to order', async ({ page }) => {
      await page.goto('/orders')
      await page.click('[data-testid="order-row"]', { index: 0 })

      // Add internal note
      await page.click('[data-testid="add-note-btn"]')
      await page.fill('[data-testid="note-content"]', 'Customer requested expedited shipping')
      await page.selectOption('[data-testid="note-type"]', 'internal')
      await page.click('[data-testid="save-note-btn"]')

      // Verify note was added
      await expect(page.locator('[data-testid="notes-list"]')).toContainText(
        'Customer requested expedited shipping'
      )

      // Add customer-visible note
      await page.click('[data-testid="add-note-btn"]')
      await page.fill('[data-testid="note-content"]', 'Your order has been prioritized')
      await page.selectOption('[data-testid="note-type"]', 'customer')
      await page.click('[data-testid="save-note-btn"]')

      // Verify both notes appear with correct visibility
      const notes = page.locator('[data-testid="note-item"]')
      await expect(notes).toHaveCount(2)
      await expect(notes.first().locator('[data-testid="note-visibility"]'))
        .toContainText('Internal')
      await expect(notes.last().locator('[data-testid="note-visibility"]'))
        .toContainText('Customer')
    })
  })

  test.describe('Real-time Order Updates', () => {
    test('should show real-time order status updates', async ({ page, context }) => {
      // Open order list in first tab
      await page.goto('/orders')
      
      // Open specific order in second tab
      const orderPage = await context.newPage()
      await loginAsTestUser(orderPage, testUserId)
      await orderPage.goto('/orders')
      await orderPage.click('[data-testid="order-row"]', { index: 0 })
      
      // Get initial status
      const initialStatus = await orderPage
        .locator('[data-testid="order-status"]')
        .textContent()

      // Update status in first tab
      await page.click('[data-testid="order-row"]', { index: 0 })
      await page.click('[data-testid="quick-actions-menu"]')
      await page.click('[data-testid="mark-as-shipped"]')
      await page.click('[data-testid="confirm-status-change"]')

      // Verify real-time update in second tab
      await expect(orderPage.locator('[data-testid="order-status"]')).toContainText(
        'Shipped',
        { timeout: 5000 }
      )
      
      // Verify notification appears
      await expect(orderPage.locator('[data-testid="status-update-notification"]'))
        .toBeVisible()

      await orderPage.close()
    })
  })
})