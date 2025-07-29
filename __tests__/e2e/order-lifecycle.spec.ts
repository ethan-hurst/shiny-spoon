import { test, expect } from '@playwright/test'
import { loginUser } from '../helpers/auth'

test.describe('Order Lifecycle Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, 'test@truthsource.io')
  })

  test.describe('Order Creation', () => {
    test('should create orders with inventory validation', async ({ page }) => {
      await page.goto('/orders')
      
      // Create new order
      await page.click('[data-testid="create-order-btn"]')
      
      // Select customer
      await page.click('[data-testid="customer-select"]')
      await page.fill('[data-testid="customer-search"]', 'Acme')
      await page.click('[data-testid="customer-option-acme"]')
      
      // Add products
      await page.click('[data-testid="add-product"]')
      await page.fill('[data-testid="product-search-0"]', 'WIDGET-001')
      await page.click('[data-testid="product-option-WIDGET-001"]')
      
      // Enter quantity
      await page.fill('[data-testid="quantity-0"]', '50')
      
      // Should show real-time inventory availability
      await expect(page.locator('[data-testid="availability-0"]')).toBeVisible()
      await expect(page.getByText('Available:')).toBeVisible()
      
      // Should apply customer pricing automatically
      await expect(page.locator('[data-testid="unit-price-0"]')).toHaveValue('249.99') // Customer contract price
      
      // Add another product
      await page.click('[data-testid="add-product"]')
      await page.fill('[data-testid="product-search-1"]', 'WIDGET-002')
      await page.click('[data-testid="product-option-WIDGET-002"]')
      await page.fill('[data-testid="quantity-1"]', '100')
      
      // Select warehouse
      await page.selectOption('[data-testid="warehouse-select"]', 'main-warehouse')
      
      // Add shipping address
      await page.fill('[data-testid="shipping-address-line1"]', '456 Delivery Ave')
      await page.fill('[data-testid="shipping-city"]', 'Shipping City')
      await page.fill('[data-testid="shipping-state"]', 'CA')
      await page.fill('[data-testid="shipping-zip"]', '90002')
      
      // Review totals
      await expect(page.locator('[data-testid="order-subtotal"]')).toBeVisible()
      await expect(page.locator('[data-testid="order-tax"]')).toBeVisible()
      await expect(page.locator('[data-testid="order-total"]')).toBeVisible()
      
      await page.click('[data-testid="place-order"]')
      
      // Should create order and show confirmation
      await expect(page.getByText('Order created successfully')).toBeVisible()
      await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+/)
      
      // Should show order number
      await expect(page.locator('[data-testid="order-number"]')).toContainText(/\d{8}-\d{4}/)
    })

    test('should handle insufficient inventory gracefully', async ({ page }) => {
      await page.goto('/orders')
      await page.click('[data-testid="create-order-btn"]')
      
      // Select customer and product
      await page.click('[data-testid="customer-select"]')
      await page.fill('[data-testid="customer-search"]', 'Acme')
      await page.click('[data-testid="customer-option-acme"]')
      
      await page.click('[data-testid="add-product"]')
      await page.fill('[data-testid="product-search-0"]', 'WIDGET-001')
      await page.click('[data-testid="product-option-WIDGET-001"]')
      
      // Enter quantity exceeding available
      await page.fill('[data-testid="quantity-0"]', '10000')
      
      // Should show warning
      await expect(page.locator('[data-testid="insufficient-stock-warning"]')).toBeVisible()
      await expect(page.getByText('Insufficient stock')).toBeVisible()
      
      // Should suggest alternatives
      await expect(page.locator('[data-testid="stock-alternatives"]')).toBeVisible()
      await expect(page.getByText('Available from other warehouses')).toBeVisible()
      
      // Should prevent order submission
      await expect(page.locator('[data-testid="place-order"]')).toBeDisabled()
    })

    test('should calculate shipping and taxes based on destination', async ({ page }) => {
      await page.goto('/orders')
      await page.click('[data-testid="create-order-btn"]')
      
      // Add customer and products
      await page.click('[data-testid="customer-select"]')
      await page.fill('[data-testid="customer-search"]', 'Acme')
      await page.click('[data-testid="customer-option-acme"]')
      
      await page.click('[data-testid="add-product"]')
      await page.fill('[data-testid="product-search-0"]', 'WIDGET-001')
      await page.click('[data-testid="product-option-WIDGET-001"]')
      await page.fill('[data-testid="quantity-0"]', '10')
      
      // Enter shipping address
      await page.fill('[data-testid="shipping-state"]', 'CA')
      await page.fill('[data-testid="shipping-zip"]', '90001')
      
      // Should calculate CA tax rate
      await expect(page.locator('[data-testid="tax-rate"]')).toContainText('8.25%')
      
      // Change to different state
      await page.fill('[data-testid="shipping-state"]', 'TX')
      await page.fill('[data-testid="shipping-zip"]', '75001')
      
      // Should update tax rate
      await expect(page.locator('[data-testid="tax-rate"]')).toContainText('6.25%')
      
      // Should show shipping options
      await expect(page.locator('[data-testid="shipping-options"]')).toBeVisible()
      await page.click('[data-testid="shipping-express"]')
      await expect(page.locator('[data-testid="shipping-cost"]')).toContainText('$')
    })
  })

  test.describe('Order Processing', () => {
    test('should move orders through fulfillment workflow', async ({ page }) => {
      await page.goto('/orders')
      
      // Click on pending order
      const pendingOrder = page.locator('[data-testid="order-row"]').filter({ has: page.locator('[data-testid="status-pending"]') }).first()
      await pendingOrder.click()
      
      // Confirm order
      await page.click('[data-testid="order-actions"]')
      await page.click('[data-testid="confirm-order"]')
      
      // Should update status
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Confirmed')
      await expect(page.getByText('Order confirmed')).toBeVisible()
      
      // Should reserve inventory
      await expect(page.locator('[data-testid="inventory-status"]')).toContainText('Reserved')
      
      // Process order
      await page.click('[data-testid="order-actions"]')
      await page.click('[data-testid="process-order"]')
      
      // Pick items
      await page.click('[data-testid="pick-all-items"]')
      await expect(page.locator('[data-testid="picked-status"]')).toContainText('All items picked')
      
      // Pack order
      await page.click('[data-testid="pack-order"]')
      await page.fill('[data-testid="package-weight"]', '5.5')
      await page.fill('[data-testid="package-dimensions"]', '12x10x8')
      await page.click('[data-testid="generate-packing-slip"]')
      
      // Should generate packing slip
      const download = await page.waitForEvent('download')
      expect(download.suggestedFilename()).toMatch(/packing_slip_.*\.pdf/)
      
      // Ship order
      await page.click('[data-testid="ship-order"]')
      await page.selectOption('[data-testid="shipping-carrier"]', 'fedex')
      await page.fill('[data-testid="tracking-number"]', '1234567890')
      await page.click('[data-testid="mark-shipped"]')
      
      // Should update status and inventory
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Shipped')
      await expect(page.getByText('Tracking number added')).toBeVisible()
      
      // Should send shipping notification
      await expect(page.getByText('Shipping notification sent')).toBeVisible()
    })

    test('should handle order modifications before fulfillment', async ({ page }) => {
      await page.goto('/orders')
      
      // Select confirmed order
      const confirmedOrder = page.locator('[data-testid="order-row"]').filter({ has: page.locator('[data-testid="status-confirmed"]') }).first()
      await confirmedOrder.click()
      
      // Edit order
      await page.click('[data-testid="edit-order"]')
      
      // Change quantity
      const firstItem = page.locator('[data-testid="order-item"]').first()
      await firstItem.locator('[data-testid="edit-quantity"]').click()
      await firstItem.locator('[data-testid="quantity-input"]').fill('75')
      await firstItem.locator('[data-testid="save-quantity"]').click()
      
      // Add new item
      await page.click('[data-testid="add-item"]')
      await page.fill('[data-testid="product-search"]', 'WIDGET-003')
      await page.click('[data-testid="product-option-WIDGET-003"]')
      await page.fill('[data-testid="new-item-quantity"]', '25')
      await page.click('[data-testid="add-to-order"]')
      
      // Remove item
      const itemToRemove = page.locator('[data-testid="order-item"]').nth(1)
      await itemToRemove.locator('[data-testid="remove-item"]').click()
      await page.click('[data-testid="confirm-remove"]')
      
      // Save changes
      await page.click('[data-testid="save-order-changes"]')
      
      // Should recalculate totals
      await expect(page.getByText('Order updated successfully')).toBeVisible()
      await expect(page.locator('[data-testid="order-modified-badge"]')).toBeVisible()
      
      // Should update inventory reservations
      await expect(page.getByText('Inventory reservations updated')).toBeVisible()
    })

    test('should handle order cancellations properly', async ({ page }) => {
      await page.goto('/orders')
      
      // Select order to cancel
      const order = page.locator('[data-testid="order-row"]').filter({ has: page.locator('[data-testid="status-confirmed"]') }).first()
      const orderNumber = await order.locator('[data-testid="order-number"]').textContent()
      await order.click()
      
      // Cancel order
      await page.click('[data-testid="order-actions"]')
      await page.click('[data-testid="cancel-order"]')
      
      // Provide reason
      await page.fill('[data-testid="cancellation-reason"]', 'Customer requested cancellation')
      await page.click('[data-testid="confirm-cancellation"]')
      
      // Should update status
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Cancelled')
      
      // Should release inventory
      await expect(page.getByText('Inventory released')).toBeVisible()
      
      // Should send cancellation email
      await expect(page.getByText('Cancellation notification sent')).toBeVisible()
      
      // Verify in order list
      await page.goto('/orders')
      await page.fill('[data-testid="order-search"]', orderNumber!)
      const cancelledOrder = page.locator('[data-testid="order-row"]').filter({ hasText: orderNumber! })
      await expect(cancelledOrder.locator('[data-testid="status-cancelled"]')).toBeVisible()
    })
  })

  test.describe('Returns and Refunds', () => {
    test('should process returns with inventory restocking', async ({ page }) => {
      await page.goto('/orders')
      
      // Select delivered order
      const deliveredOrder = page.locator('[data-testid="order-row"]').filter({ has: page.locator('[data-testid="status-delivered"]') }).first()
      await deliveredOrder.click()
      
      // Initiate return
      await page.click('[data-testid="initiate-return"]')
      
      // Select items to return
      await page.check('[data-testid="return-item-0"]')
      await page.fill('[data-testid="return-quantity-0"]', '5')
      await page.selectOption('[data-testid="return-reason-0"]', 'defective')
      await page.fill('[data-testid="return-notes-0"]', 'Product not working as expected')
      
      // Calculate refund
      await page.click('[data-testid="calculate-refund"]')
      await expect(page.locator('[data-testid="refund-subtotal"]')).toBeVisible()
      await expect(page.locator('[data-testid="refund-tax"]')).toBeVisible()
      await expect(page.locator('[data-testid="refund-total"]')).toBeVisible()
      
      // Apply restocking fee if applicable
      await page.check('[data-testid="apply-restocking-fee"]')
      await expect(page.locator('[data-testid="restocking-fee"]')).toContainText('15%')
      
      // Process return
      await page.click('[data-testid="process-return"]')
      
      // Should create RMA
      await expect(page.getByText('Return authorization created')).toBeVisible()
      await expect(page.locator('[data-testid="rma-number"]')).toContainText(/RMA-\d+/)
      
      // When items are received
      await page.click('[data-testid="receive-return"]')
      await page.check('[data-testid="items-received"]')
      await page.selectOption('[data-testid="item-condition"]', 'good')
      await page.click('[data-testid="complete-return"]')
      
      // Should restock inventory
      await expect(page.getByText('Inventory restocked')).toBeVisible()
      
      // Should process refund
      await expect(page.getByText('Refund processed')).toBeVisible()
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Refunded')
    })
  })

  test.describe('Order Analytics', () => {
    test('should track order metrics and performance', async ({ page }) => {
      await page.goto('/orders/analytics')
      
      // Date range selector
      await page.selectOption('[data-testid="date-range"]', 'last_30_days')
      
      // Should show key metrics
      await expect(page.locator('[data-testid="total-orders"]')).toBeVisible()
      await expect(page.locator('[data-testid="order-value"]')).toBeVisible()
      await expect(page.locator('[data-testid="average-order-value"]')).toBeVisible()
      await expect(page.locator('[data-testid="fulfillment-rate"]')).toBeVisible()
      
      // Order status breakdown
      await expect(page.locator('[data-testid="status-chart"]')).toBeVisible()
      
      // Fulfillment time analysis
      await expect(page.locator('[data-testid="fulfillment-time-chart"]')).toBeVisible()
      await expect(page.getByText('Average fulfillment time:')).toBeVisible()
      
      // Top products by orders
      await expect(page.locator('[data-testid="top-products-table"]')).toBeVisible()
      
      // Customer order patterns
      await page.click('[data-testid="customer-analytics-tab"]')
      await expect(page.locator('[data-testid="repeat-order-rate"]')).toBeVisible()
      await expect(page.locator('[data-testid="customer-lifetime-value"]')).toBeVisible()
      
      // Export analytics
      await page.click('[data-testid="export-analytics"]')
      const download = await page.waitForEvent('download')
      expect(download.suggestedFilename()).toMatch(/order_analytics_.*\.xlsx/)
    })

    test('should identify and alert on order anomalies', async ({ page }) => {
      await page.goto('/orders')
      
      // Should show anomaly indicators
      await expect(page.locator('[data-testid="anomaly-alert"]')).toBeVisible()
      await expect(page.getByText('Unusual order pattern detected')).toBeVisible()
      
      // Click to view details
      await page.click('[data-testid="view-anomaly-details"]')
      
      // Should show anomaly analysis
      await expect(page.locator('[data-testid="anomaly-dialog"]')).toBeVisible()
      await expect(page.getByText('Order velocity increased 300%')).toBeVisible()
      await expect(page.getByText('Recommended action:')).toBeVisible()
      
      // Should suggest inventory adjustments
      await expect(page.getByText('Consider increasing stock levels')).toBeVisible()
      await page.click('[data-testid="adjust-inventory-suggestion"]')
      
      // Should navigate to inventory with pre-filled adjustments
      await expect(page).toHaveURL(/\/inventory/)
      await expect(page.locator('[data-testid="suggested-adjustment-banner"]')).toBeVisible()
    })
  })
})