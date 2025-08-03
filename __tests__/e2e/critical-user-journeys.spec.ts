import { expect, test } from '@playwright/test'

test.describe('Critical User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@truthsource.io')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')

    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 })
  })

  test.describe('Authentication & User Management', () => {
    test('should complete user registration and onboarding', async ({
      page,
    }) => {
      // Start registration
      await page.goto('/signup')
      await page.fill('[data-testid="email-input"]', 'newuser@company.com')
      await page.fill('[data-testid="password-input"]', 'SecurePass123!')
      await page.fill('[data-testid="company-name"]', 'Test Company Inc.')
      await page.click('[data-testid="signup-button"]')

      // Wait for email verification
      await page.waitForSelector('[data-testid="verification-sent"]')

      // Complete onboarding
      await page.goto('/onboarding')
      await page.fill('[data-testid="warehouse-name"]', 'Main Warehouse')
      await page.fill('[data-testid="warehouse-address"]', '123 Business St')
      await page.click('[data-testid="complete-onboarding"]')

      // Verify dashboard access
      await page.waitForSelector('[data-testid="dashboard"]')
      const welcomeMessage = await page.textContent(
        '[data-testid="welcome-message"]'
      )
      expect(welcomeMessage).toContain('Welcome to TruthSource')
    })

    test('should handle password reset flow', async ({ page }) => {
      await page.goto('/reset-password')
      await page.fill('[data-testid="email-input"]', 'user@company.com')
      await page.click('[data-testid="reset-button"]')

      await page.waitForSelector('[data-testid="reset-sent"]')
      const message = await page.textContent('[data-testid="reset-sent"]')
      expect(message).toContain('Password reset email sent')
    })
  })

  test.describe('Inventory Management', () => {
    test('should complete inventory setup and management', async ({ page }) => {
      // Navigate to inventory
      await page.goto('/inventory')
      await page.waitForSelector('[data-testid="inventory-page"]')

      // Add new product
      await page.click('[data-testid="add-product-button"]')
      await page.fill('[data-testid="product-sku"]', 'TEST-001')
      await page.fill('[data-testid="product-name"]', 'Test Product')
      await page.fill(
        '[data-testid="product-description"]',
        'A test product for E2E testing'
      )
      await page.fill('[data-testid="product-price"]', '29.99')
      await page.selectOption('[data-testid="product-category"]', 'Electronics')
      await page.click('[data-testid="save-product"]')

      // Verify product created
      await page.waitForSelector('[data-testid="product-success"]')

      // Add inventory
      await page.click('[data-testid="add-inventory-button"]')
      await page.selectOption(
        '[data-testid="warehouse-select"]',
        'Main Warehouse'
      )
      await page.fill('[data-testid="quantity-input"]', '100')
      await page.fill('[data-testid="reorder-point"]', '10')
      await page.click('[data-testid="save-inventory"]')

      // Verify inventory added
      await page.waitForSelector('[data-testid="inventory-success"]')

      // Check inventory levels
      const inventoryItem = await page.$('[data-testid="inventory-item"]')
      expect(inventoryItem).toBeTruthy()

      const quantity = await page.textContent(
        '[data-testid="quantity-display"]'
      )
      expect(quantity).toContain('100')
    })

    test('should handle low stock alerts', async ({ page }) => {
      await page.goto('/inventory')

      // Set up low stock scenario
      await page.click('[data-testid="edit-inventory-button"]')
      await page.fill('[data-testid="quantity-input"]', '5')
      await page.click('[data-testid="save-inventory"]')

      // Check for low stock alert
      await page.waitForSelector('[data-testid="low-stock-alert"]')
      const alertText = await page.textContent(
        '[data-testid="low-stock-alert"]'
      )
      expect(alertText).toContain('Low stock')
    })
  })

  test.describe('Order Processing', () => {
    test('should complete order creation and fulfillment', async ({ page }) => {
      await page.goto('/orders')
      await page.waitForSelector('[data-testid="orders-page"]')

      // Create new order
      await page.click('[data-testid="create-order-button"]')
      await page.fill('[data-testid="customer-search"]', 'Test Customer')
      await page.click('[data-testid="customer-option"]')

      // Add products
      await page.click('[data-testid="add-product-button"]')
      await page.fill('[data-testid="product-search"]', 'Test Product')
      await page.click('[data-testid="product-option"]')
      await page.fill('[data-testid="quantity-input"]', '2')
      await page.click('[data-testid="add-to-order"]')

      // Fill shipping info
      await page.fill('[data-testid="shipping-address"]', '123 Test St')
      await page.fill('[data-testid="shipping-city"]', 'Test City')
      await page.fill('[data-testid="shipping-state"]', 'TS')
      await page.fill('[data-testid="shipping-zip"]', '12345')

      // Submit order
      await page.click('[data-testid="submit-order"]')
      await page.waitForSelector('[data-testid="order-success"]')

      // Process order
      await page.click('[data-testid="process-order"]')
      await page.selectOption('[data-testid="order-status"]', 'processing')
      await page.click('[data-testid="update-status"]')

      // Verify status change
      const status = await page.textContent(
        '[data-testid="order-status-display"]'
      )
      expect(status).toContain('processing')
    })

    test('should handle order cancellation and refunds', async ({ page }) => {
      await page.goto('/orders')

      // Find existing order
      const orderItem = await page.$('[data-testid="order-item"]')
      await orderItem!.click()

      // Cancel order
      await page.click('[data-testid="cancel-order-button"]')
      await page.fill('[data-testid="cancellation-reason"]', 'Customer request')
      await page.click('[data-testid="confirm-cancellation"]')

      // Verify cancellation
      await page.waitForSelector('[data-testid="order-cancelled"]')
      const status = await page.textContent(
        '[data-testid="order-status-display"]'
      )
      expect(status).toContain('cancelled')
    })
  })

  test.describe('Integration Management', () => {
    test('should set up Shopify integration', async ({ page }) => {
      await page.goto('/integrations')
      await page.waitForSelector('[data-testid="integrations-page"]')

      // Add Shopify integration
      await page.click('[data-testid="add-integration"]')
      await page.selectOption('[data-testid="platform-select"]', 'shopify')
      await page.fill('[data-testid="shop-domain"]', 'test-store.myshopify.com')
      await page.fill('[data-testid="access-token"]', 'test-access-token')
      await page.click('[data-testid="test-connection"]')

      // Wait for connection test
      await page.waitForSelector('[data-testid="connection-success"]')

      // Configure sync settings
      await page.check('[data-testid="sync-products"]')
      await page.check('[data-testid="sync-inventory"]')
      await page.selectOption('[data-testid="sync-frequency"]', 'hourly')
      await page.click('[data-testid="save-integration"]')

      // Verify integration active
      await page.waitForSelector('[data-testid="integration-active"]')
      const status = await page.textContent(
        '[data-testid="integration-status"]'
      )
      expect(status).toContain('Active')
    })

    test('should handle integration sync and monitoring', async ({ page }) => {
      await page.goto('/integrations')

      // Trigger manual sync
      await page.click('[data-testid="sync-now"]')
      await page.waitForSelector('[data-testid="sync-in-progress"]')

      // Wait for sync completion
      await page.waitForSelector('[data-testid="sync-complete"]', {
        timeout: 30000,
      })

      // Check sync results
      const syncStatus = await page.textContent('[data-testid="sync-status"]')
      expect(syncStatus).toContain('Complete')

      // View sync logs
      await page.click('[data-testid="view-logs"]')
      await page.waitForSelector('[data-testid="sync-logs"]')

      const logs = await page.$$('[data-testid="log-entry"]')
      expect(logs.length).toBeGreaterThan(0)
    })
  })

  test.describe('Analytics & Reporting', () => {
    test('should generate and export reports', async ({ page }) => {
      await page.goto('/reports')
      await page.waitForSelector('[data-testid="reports-page"]')

      // Create custom report
      await page.click('[data-testid="create-report"]')
      await page.fill('[data-testid="report-name"]', 'E2E Test Report')
      await page.selectOption('[data-testid="report-type"]', 'inventory')
      await page.selectOption('[data-testid="date-range"]', 'last-30-days')
      await page.click('[data-testid="generate-report"]')

      // Wait for report generation
      await page.waitForSelector('[data-testid="report-ready"]', {
        timeout: 30000,
      })

      // Export report
      await page.click('[data-testid="export-csv"]')

      // Verify download started
      const downloadPromise = page.waitForEvent('download')
      await downloadPromise
    })

    test('should view analytics dashboard', async ({ page }) => {
      await page.goto('/analytics')
      await page.waitForSelector('[data-testid="analytics-page"]')

      // Check key metrics
      const totalProducts = await page.textContent(
        '[data-testid="total-products"]'
      )
      expect(totalProducts).toBeTruthy()

      const totalOrders = await page.textContent('[data-testid="total-orders"]')
      expect(totalOrders).toBeTruthy()

      // Check charts load
      await page.waitForSelector('[data-testid="inventory-chart"]')
      await page.waitForSelector('[data-testid="orders-chart"]')

      // Test date range filter
      await page.click('[data-testid="date-picker"]')
      await page.click('[data-testid="last-7-days"]')

      // Verify data updates
      await page.waitForSelector('[data-testid="data-updated"]')
    })
  })

  test.describe('Settings & Configuration', () => {
    test('should manage user settings and preferences', async ({ page }) => {
      await page.goto('/settings')
      await page.waitForSelector('[data-testid="settings-page"]')

      // Update profile
      await page.click('[data-testid="edit-profile"]')
      await page.fill('[data-testid="display-name"]', 'Updated Name')
      await page.fill('[data-testid="phone"]', '+1-555-0123')
      await page.click('[data-testid="save-profile"]')

      // Verify update
      await page.waitForSelector('[data-testid="profile-updated"]')

      // Change password
      await page.click('[data-testid="change-password"]')
      await page.fill('[data-testid="current-password"]', 'oldpassword')
      await page.fill('[data-testid="new-password"]', 'newpassword123')
      await page.fill('[data-testid="confirm-password"]', 'newpassword123')
      await page.click('[data-testid="update-password"]')

      // Verify password change
      await page.waitForSelector('[data-testid="password-updated"]')
    })

    test('should configure organization settings', async ({ page }) => {
      await page.goto('/settings/organization')
      await page.waitForSelector('[data-testid="org-settings-page"]')

      // Update organization info
      await page.click('[data-testid="edit-organization"]')
      await page.fill('[data-testid="org-name"]', 'Updated Company Name')
      await page.fill('[data-testid="org-address"]', '456 Business Ave')
      await page.fill('[data-testid="org-phone"]', '+1-555-0456')
      await page.click('[data-testid="save-organization"]')

      // Verify update
      await page.waitForSelector('[data-testid="org-updated"]')

      // Configure notifications
      await page.click('[data-testid="notification-settings"]')
      await page.check('[data-testid="email-notifications"]')
      await page.check('[data-testid="low-stock-alerts"]')
      await page.click('[data-testid="save-notifications"]')

      // Verify notification settings
      await page.waitForSelector('[data-testid="notifications-saved"]')
    })
  })

  test.describe('Error Handling & Edge Cases', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate offline mode
      await page.route('**/*', (route) => route.abort())

      await page.goto('/inventory')

      // Check for error message
      await page.waitForSelector('[data-testid="error-message"]')
      const errorText = await page.textContent('[data-testid="error-message"]')
      expect(errorText).toContain('Unable to load data')

      // Test retry functionality
      await page.click('[data-testid="retry-button"]')
      await page.waitForSelector('[data-testid="loading"]')
    })

    test('should handle invalid data gracefully', async ({ page }) => {
      await page.goto('/inventory')

      // Try to create product with invalid data
      await page.click('[data-testid="add-product-button"]')
      await page.fill('[data-testid="product-sku"]', '') // Empty SKU
      await page.fill('[data-testid="product-name"]', '') // Empty name
      await page.fill('[data-testid="product-price"]', 'invalid') // Invalid price
      await page.click('[data-testid="save-product"]')

      // Check for validation errors
      await page.waitForSelector('[data-testid="validation-error"]')
      const errors = await page.$$('[data-testid="validation-error"]')
      expect(errors.length).toBeGreaterThan(0)
    })

    test('should handle concurrent user actions', async ({ page, context }) => {
      // Create second page for concurrent testing
      const page2 = await context.newPage()

      await page.goto('/inventory')
      await page2.goto('/inventory')

      // Both pages try to edit same item
      await page.click('[data-testid="edit-inventory"]')
      await page2.click('[data-testid="edit-inventory"]')

      await page.fill('[data-testid="quantity-input"]', '50')
      await page2.fill('[data-testid="quantity-input"]', '75')

      await page.click('[data-testid="save-inventory"]')
      await page2.click('[data-testid="save-inventory"]')

      // Check for conflict resolution
      await page.waitForSelector('[data-testid="conflict-resolution"]')
      const conflictMessage = await page.textContent(
        '[data-testid="conflict-resolution"]'
      )
      expect(conflictMessage).toContain('Another user has modified this item')
    })
  })

  test.describe('Performance & Load Testing', () => {
    test('should handle large datasets efficiently', async ({ page }) => {
      await page.goto('/inventory')

      // Set page size to maximum
      await page.selectOption('[data-testid="page-size"]', '100')

      // Wait for data to load
      await page.waitForSelector('[data-testid="inventory-item"]', {
        timeout: 10000,
      })

      // Check pagination works
      const nextButton = await page.$('[data-testid="next-page"]')
      if (nextButton) {
        await nextButton.click()
        await page.waitForSelector('[data-testid="loading"]')
        await page.waitForSelector('[data-testid="inventory-item"]')
      }

      // Test search functionality
      await page.fill('[data-testid="search-input"]', 'test')
      await page.waitForSelector('[data-testid="search-results"]')

      // Verify search performance
      const searchTime = await page.evaluate(() => {
        return performance.now()
      })
      expect(searchTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    test('should maintain responsiveness during heavy operations', async ({
      page,
    }) => {
      await page.goto('/reports')

      // Generate large report
      await page.click('[data-testid="create-report"]')
      await page.selectOption('[data-testid="report-type"]', 'inventory')
      await page.selectOption('[data-testid="date-range"]', 'last-year')
      await page.click('[data-testid="generate-report"]')

      // UI should remain responsive
      await page.waitForSelector('[data-testid="progress-indicator"]')

      // Test that other UI elements remain interactive
      const navButton = await page.$('[data-testid="nav-inventory"]')
      expect(navButton).toBeTruthy()

      // Should be able to navigate away
      await navButton!.click()
      await page.waitForSelector('[data-testid="inventory-page"]')
    })
  })
})
