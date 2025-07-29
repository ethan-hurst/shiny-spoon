import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser, loginUser } from '../helpers/auth'
import { createTestProduct, deleteTestProduct } from '../helpers/products'
import { createTestCustomer, deleteTestCustomer } from '../helpers/customers'

test.describe('Orders Management', () => {
  let userEmail: string
  let userId: string
  let productId: string
  let customerId: string

  test.beforeAll(async () => {
    // Create test user and related data
    const user = await createTestUser()
    userEmail = user.email
    userId = user.id

    // Create test product
    productId = await createTestProduct(user.organizationId)
    
    // Create test customer
    customerId = await createTestCustomer(user.organizationId)
  })

  test.afterAll(async () => {
    // Clean up test data
    await deleteTestProduct(productId)
    await deleteTestCustomer(customerId)
    await deleteTestUser(userId)
  })

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginUser(page, userEmail)
  })

  test('should display orders page', async ({ page }) => {
    await page.goto('/orders')
    
    // Check page elements
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
    await expect(page.getByText('Manage customer orders')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Order' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible()
  })

  test('should create a new order', async ({ page }) => {
    await page.goto('/orders')
    
    // Click create order button
    await page.getByRole('button', { name: 'Create Order' }).click()
    
    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Create New Order')).toBeVisible()
    
    // Select customer (optional)
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /Test Customer/ }).click()
    
    // Add product
    await page.locator('select[name="items.0.product_id"]').selectOption({ index: 1 })
    
    // Set quantity
    await page.getByRole('spinbutton', { name: 'Quantity' }).fill('5')
    
    // Add order notes
    await page.getByPlaceholder('Add any special instructions').fill('Test order from E2E')
    
    // Submit form
    await page.getByRole('button', { name: 'Create Order' }).last().click()
    
    // Verify success
    await expect(page.getByText('Order created successfully')).toBeVisible()
    
    // Verify order appears in list
    await expect(page.getByText('Test order from E2E')).toBeVisible({ timeout: 10000 })
  })

  test('should view order details', async ({ page }) => {
    await page.goto('/orders')
    
    // Click on first order
    await page.locator('table tbody tr').first().locator('a').first().click()
    
    // Verify order detail page
    await expect(page.getByText('Order #')).toBeVisible()
    await expect(page.getByText('Order Items')).toBeVisible()
    await expect(page.getByText('Order Summary')).toBeVisible()
    await expect(page.getByText('Customer Information')).toBeVisible()
  })

  test('should update order status', async ({ page }) => {
    await page.goto('/orders')
    
    // Navigate to first order
    await page.locator('table tbody tr').first().locator('a').first().click()
    
    // Click update status
    await page.getByRole('button', { name: 'Update Status' }).click()
    
    // Select new status
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Processing' }).click()
    
    // Save
    await page.getByRole('button', { name: 'Save' }).click()
    
    // Verify success
    await expect(page.getByText('Order status updated successfully')).toBeVisible()
    await expect(page.getByText('Processing')).toBeVisible()
  })

  test('should export orders', async ({ page }) => {
    await page.goto('/orders')
    
    // Setup download promise before clicking
    const downloadPromise = page.waitForEvent('download')
    
    // Click export button
    await page.getByRole('button', { name: 'Export' }).click()
    
    // Wait for download
    const download = await downloadPromise
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/orders_export_.*\.csv/)
    
    // Verify success message
    await expect(page.getByText(/Exported \d+ orders/)).toBeVisible()
  })

  test('should handle order creation errors', async ({ page }) => {
    await page.goto('/orders')
    
    // Click create order button
    await page.getByRole('button', { name: 'Create Order' }).click()
    
    // Try to submit without selecting product
    await page.getByRole('button', { name: 'Create Order' }).last().click()
    
    // Verify error message
    await expect(page.getByText('Product is required')).toBeVisible()
  })

  test('should filter orders by status', async ({ page }) => {
    await page.goto('/orders?status=pending')
    
    // Verify filtered results
    const statusBadges = page.locator('[data-testid="order-status"]')
    const count = await statusBadges.count()
    
    for (let i = 0; i < count; i++) {
      await expect(statusBadges.nth(i)).toHaveText('Pending')
    }
  })

  test('should search orders', async ({ page }) => {
    await page.goto('/orders')
    
    // Enter search term
    await page.getByPlaceholder('Search orders...').fill('TEST')
    await page.keyboard.press('Enter')
    
    // Verify URL updated
    await expect(page).toHaveURL(/search=TEST/)
    
    // Verify filtered results (implementation dependent)
  })

  test('should handle pagination', async ({ page }) => {
    await page.goto('/orders')
    
    // Check if pagination exists
    const pagination = page.locator('[data-testid="pagination"]')
    if (await pagination.isVisible()) {
      // Click next page
      await page.getByRole('button', { name: 'Next' }).click()
      
      // Verify URL updated
      await expect(page).toHaveURL(/page=2/)
    }
  })

  test('should show order statistics', async ({ page }) => {
    await page.goto('/orders')
    
    // Verify stats cards
    await expect(page.getByText('Total Orders')).toBeVisible()
    await expect(page.getByText('Pending')).toBeVisible()
    await expect(page.getByText('Shipped')).toBeVisible()
    await expect(page.getByText('Total Revenue')).toBeVisible()
  })
})

test.describe('Order Detail Page', () => {
  test('should show 404 for non-existent order', async ({ page }) => {
    await loginUser(page, 'test@example.com')
    
    // Navigate to non-existent order
    await page.goto('/orders/00000000-0000-0000-0000-000000000000')
    
    // Verify 404 page
    await expect(page.getByText('404')).toBeVisible()
  })

  test('should display order timeline', async ({ page }) => {
    await loginUser(page, 'test@example.com')
    await page.goto('/orders')
    
    // Navigate to an order with status history
    await page.locator('table tbody tr').first().locator('a').first().click()
    
    // Verify status history section
    const statusHistory = page.locator('[data-testid="status-history"]')
    if (await statusHistory.isVisible()) {
      await expect(statusHistory.getByText('Status History')).toBeVisible()
    }
  })
})

test.describe('Order Security', () => {
  test('should not allow unauthenticated access', async ({ page }) => {
    // Try to access orders without login
    await page.goto('/orders')
    
    // Should redirect to login
    await expect(page).toHaveURL(/login/)
  })

  test('should not show orders from other organizations', async ({ page }) => {
    // This would require creating orders for different organizations
    // and verifying isolation
  })
})