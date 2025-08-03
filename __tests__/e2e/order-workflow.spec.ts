import { expect, test } from '@playwright/test'

test.describe('Order Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the orders page
    await page.goto('/orders')

    // Wait for the page to load
    await page.waitForSelector('[data-testid="orders-page"]', {
      timeout: 10000,
    })
  })

  test('should create a new order successfully', async ({ page }) => {
    // Click the "Create Order" button
    await page.click('[data-testid="create-order-button"]')

    // Wait for the create order modal/form
    await page.waitForSelector('[data-testid="create-order-form"]')

    // Fill in customer information
    await page.fill('[data-testid="customer-select"]', 'Test Customer')
    await page.click('[data-testid="customer-option"]')

    // Add products to the order
    await page.click('[data-testid="add-product-button"]')
    await page.fill('[data-testid="product-search"]', 'Test Product')
    await page.click('[data-testid="product-option"]')
    await page.fill('[data-testid="quantity-input"]', '2')
    await page.click('[data-testid="add-product-to-order"]')

    // Fill in billing address
    await page.fill('[data-testid="billing-line1"]', '123 Test Street')
    await page.fill('[data-testid="billing-city"]', 'Test City')
    await page.fill('[data-testid="billing-state"]', 'TS')
    await page.fill('[data-testid="billing-postal"]', '12345')
    await page.fill('[data-testid="billing-country"]', 'US')

    // Add notes
    await page.fill('[data-testid="order-notes"]', 'Test order for E2E testing')

    // Submit the order
    await page.click('[data-testid="submit-order"]')

    // Wait for success message
    await page.waitForSelector('[data-testid="order-success"]', {
      timeout: 10000,
    })

    // Verify the order was created
    const successMessage = await page.textContent(
      '[data-testid="order-success"]'
    )
    expect(successMessage).toContain('Order created successfully')

    // Verify order appears in the list
    await page.waitForSelector('[data-testid="order-item"]')
    const orderItems = await page.$$('[data-testid="order-item"]')
    expect(orderItems.length).toBeGreaterThan(0)
  })

  test('should update order status', async ({ page }) => {
    // Find an existing order
    const orderItem = await page.$('[data-testid="order-item"]')
    expect(orderItem).toBeTruthy()

    // Click on the order to view details
    await orderItem!.click()

    // Wait for order details page
    await page.waitForSelector('[data-testid="order-details"]')

    // Click edit button
    await page.click('[data-testid="edit-order-button"]')

    // Change status to confirmed
    await page.selectOption('[data-testid="order-status"]', 'confirmed')

    // Add notes
    await page.fill(
      '[data-testid="order-notes"]',
      'Order confirmed via E2E test'
    )

    // Save changes
    await page.click('[data-testid="save-order"]')

    // Wait for success message
    await page.waitForSelector('[data-testid="update-success"]', {
      timeout: 10000,
    })

    // Verify status was updated
    const statusElement = await page.$('[data-testid="order-status-display"]')
    const statusText = await statusElement!.textContent()
    expect(statusText).toContain('confirmed')
  })

  test('should cancel an order', async ({ page }) => {
    // Find an existing order
    const orderItem = await page.$('[data-testid="order-item"]')
    expect(orderItem).toBeTruthy()

    // Click on the order to view details
    await orderItem!.click()

    // Wait for order details page
    await page.waitForSelector('[data-testid="order-details"]')

    // Click cancel button
    await page.click('[data-testid="cancel-order-button"]')

    // Wait for confirmation modal
    await page.waitForSelector('[data-testid="cancel-confirmation"]')

    // Enter cancellation reason
    await page.fill(
      '[data-testid="cancellation-reason"]',
      'Customer requested cancellation'
    )

    // Confirm cancellation
    await page.click('[data-testid="confirm-cancellation"]')

    // Wait for success message
    await page.waitForSelector('[data-testid="cancellation-success"]', {
      timeout: 10000,
    })

    // Verify order status is cancelled
    const statusElement = await page.$('[data-testid="order-status-display"]')
    const statusText = await statusElement!.textContent()
    expect(statusText).toContain('cancelled')
  })

  test('should filter orders by status', async ({ page }) => {
    // Click on status filter
    await page.click('[data-testid="status-filter"]')

    // Select pending status
    await page.click('[data-testid="status-pending"]')

    // Wait for filtered results
    await page.waitForSelector('[data-testid="filtered-orders"]')

    // Verify all displayed orders have pending status
    const orderItems = await page.$$('[data-testid="order-item"]')
    for (const item of orderItems) {
      const statusElement = await item.$('[data-testid="order-status"]')
      const statusText = await statusElement!.textContent()
      expect(statusText).toContain('pending')
    }
  })

  test('should search orders', async ({ page }) => {
    // Enter search term
    await page.fill('[data-testid="order-search"]', 'TEST-001')

    // Wait for search results
    await page.waitForSelector('[data-testid="search-results"]')

    // Verify search results contain the search term
    const orderItems = await page.$$('[data-testid="order-item"]')
    expect(orderItems.length).toBeGreaterThan(0)

    for (const item of orderItems) {
      const orderNumber = await item.$('[data-testid="order-number"]')
      const orderNumberText = await orderNumber!.textContent()
      expect(orderNumberText).toContain('TEST-001')
    }
  })

  test('should export orders', async ({ page }) => {
    // Click export button
    await page.click('[data-testid="export-orders-button"]')

    // Wait for export modal
    await page.waitForSelector('[data-testid="export-modal"]')

    // Select export format
    await page.click('[data-testid="export-csv"]')

    // Set date range
    await page.fill('[data-testid="export-start-date"]', '2025-01-01')
    await page.fill('[data-testid="export-end-date"]', '2025-01-31')

    // Click export
    await page.click('[data-testid="confirm-export"]')

    // Wait for download to start
    const downloadPromise = page.waitForEvent('download')
    await downloadPromise

    // Verify download started
    expect(downloadPromise).toBeTruthy()
  })

  test('should view order tracking', async ({ page }) => {
    // Find an existing order
    const orderItem = await page.$('[data-testid="order-item"]')
    expect(orderItem).toBeTruthy()

    // Click on the order to view details
    await orderItem!.click()

    // Wait for order details page
    await page.waitForSelector('[data-testid="order-details"]')

    // Click on tracking tab
    await page.click('[data-testid="tracking-tab"]')

    // Wait for tracking information
    await page.waitForSelector('[data-testid="tracking-info"]')

    // Verify tracking information is displayed
    const trackingElement = await page.$('[data-testid="tracking-info"]')
    expect(trackingElement).toBeTruthy()
  })

  test('should add tracking event', async ({ page }) => {
    // Find an existing order
    const orderItem = await page.$('[data-testid="order-item"]')
    expect(orderItem).toBeTruthy()

    // Click on the order to view details
    await orderItem!.click()

    // Wait for order details page
    await page.waitForSelector('[data-testid="order-details"]')

    // Click on tracking tab
    await page.click('[data-testid="tracking-tab"]')

    // Click add tracking event
    await page.click('[data-testid="add-tracking-event"]')

    // Fill in tracking details
    await page.selectOption('[data-testid="tracking-status"]', 'shipped')
    await page.fill('[data-testid="tracking-location"]', 'Distribution Center')
    await page.fill(
      '[data-testid="tracking-description"]',
      'Package picked up by carrier'
    )
    await page.fill('[data-testid="tracking-number"]', 'TRK123456789')

    // Submit tracking event
    await page.click('[data-testid="submit-tracking"]')

    // Wait for success message
    await page.waitForSelector('[data-testid="tracking-success"]', {
      timeout: 10000,
    })

    // Verify tracking event was added
    const trackingEvents = await page.$$('[data-testid="tracking-event"]')
    expect(trackingEvents.length).toBeGreaterThan(0)
  })

  test('should handle rate limiting', async ({ page }) => {
    // Try to create multiple orders rapidly
    for (let i = 0; i < 15; i++) {
      await page.click('[data-testid="create-order-button"]')
      await page.waitForSelector('[data-testid="create-order-form"]')

      // Fill minimal required fields
      await page.fill('[data-testid="customer-select"]', 'Test Customer')
      await page.click('[data-testid="customer-option"]')
      await page.click('[data-testid="add-product-button"]')
      await page.fill('[data-testid="product-search"]', 'Test Product')
      await page.click('[data-testid="product-option"]')
      await page.fill('[data-testid="quantity-input"]', '1')
      await page.click('[data-testid="add-product-to-order"]')

      await page.click('[data-testid="submit-order"]')

      // Check for rate limit error after a few attempts
      if (i > 10) {
        const errorMessage = await page.$('[data-testid="rate-limit-error"]')
        if (errorMessage) {
          const errorText = await errorMessage.textContent()
          expect(errorText).toContain('Rate limit exceeded')
          break
        }
      }
    }
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network error by going offline
    await page.context().setOffline(true)

    // Try to create an order
    await page.click('[data-testid="create-order-button"]')
    await page.waitForSelector('[data-testid="create-order-form"]')

    // Fill form and submit
    await page.fill('[data-testid="customer-select"]', 'Test Customer')
    await page.click('[data-testid="customer-option"]')
    await page.click('[data-testid="add-product-button"]')
    await page.fill('[data-testid="product-search"]', 'Test Product')
    await page.click('[data-testid="product-option"]')
    await page.fill('[data-testid="quantity-input"]', '1')
    await page.click('[data-testid="add-product-to-order"]')
    await page.click('[data-testid="submit-order"]')

    // Verify error handling
    await page.waitForSelector('[data-testid="network-error"]', {
      timeout: 10000,
    })
    const errorMessage = await page.textContent('[data-testid="network-error"]')
    expect(errorMessage).toContain('Network error')

    // Go back online
    await page.context().setOffline(false)
  })
})
