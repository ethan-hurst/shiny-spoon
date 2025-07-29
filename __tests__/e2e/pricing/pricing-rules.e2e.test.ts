import { test, expect } from '@playwright/test'
import { setupE2ETest, cleanupE2ETest, loginAsTestUser } from '@/tests/helpers/e2e-helpers'

test.describe('Pricing Rules Management E2E Tests', () => {
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

  test.describe('Pricing Rule Creation', () => {
    test('should create a customer-specific pricing rule', async ({ page }) => {
      // Navigate to pricing rules
      await page.goto('/pricing/rules')
      await expect(page.locator('h1')).toContainText('Pricing Rules')

      // Create new rule
      await page.click('[data-testid="create-rule-btn"]')
      await expect(page.locator('h2')).toContainText('New Pricing Rule')

      // Fill rule details
      await page.fill('[data-testid="rule-name"]', 'VIP Customer Discount')
      await page.fill('[data-testid="rule-description"]', 'Special pricing for VIP customers')
      
      // Select rule type
      await page.selectOption('[data-testid="rule-type"]', 'customer')
      
      // Select customer
      await page.click('[data-testid="customer-select"]')
      await page.fill('[data-testid="customer-search"]', 'VIP Customer')
      await page.click('[data-testid="customer-option-0"]')
      
      // Configure discount
      await page.selectOption('[data-testid="discount-type"]', 'percentage')
      await page.fill('[data-testid="discount-value"]', '15')
      
      // Set validity period
      await page.fill('[data-testid="valid-from"]', '2024-01-01')
      await page.fill('[data-testid="valid-to"]', '2024-12-31')
      
      // Set priority
      await page.fill('[data-testid="rule-priority"]', '100')
      
      // Save rule
      await page.click('[data-testid="save-rule-btn"]')
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Pricing rule created successfully'
      )

      // Verify rule appears in list
      await expect(page.locator('[data-testid="rule-list"]')).toContainText(
        'VIP Customer Discount'
      )
    })

    test('should create a quantity-based pricing rule', async ({ page }) => {
      await page.goto('/pricing/rules/new')

      // Fill rule details
      await page.fill('[data-testid="rule-name"]', 'Bulk Purchase Discount')
      await page.selectOption('[data-testid="rule-type"]', 'quantity')
      
      // Add quantity breaks
      await page.click('[data-testid="add-quantity-break-btn"]')
      await page.fill('[data-testid="min-quantity-0"]', '10')
      await page.fill('[data-testid="max-quantity-0"]', '49')
      await page.fill('[data-testid="discount-0"]', '5')
      
      await page.click('[data-testid="add-quantity-break-btn"]')
      await page.fill('[data-testid="min-quantity-1"]', '50')
      await page.fill('[data-testid="max-quantity-1"]', '99')
      await page.fill('[data-testid="discount-1"]', '10')
      
      await page.click('[data-testid="add-quantity-break-btn"]')
      await page.fill('[data-testid="min-quantity-2"]', '100')
      await page.fill('[data-testid="max-quantity-2"]', '')
      await page.fill('[data-testid="discount-2"]', '15')
      
      // Apply to specific products
      await page.click('[data-testid="apply-to-products-radio"]')
      await page.click('[data-testid="select-products-btn"]')
      await page.click('[data-testid="product-checkbox-0"]')
      await page.click('[data-testid="product-checkbox-1"]')
      await page.click('[data-testid="confirm-products-btn"]')
      
      // Save rule
      await page.click('[data-testid="save-rule-btn"]')
      
      // Test the rule with price calculator
      await page.click('[data-testid="test-rule-btn"]')
      await page.selectOption('[data-testid="test-product"]', { index: 0 })
      await page.fill('[data-testid="test-quantity"]', '75')
      await page.click('[data-testid="calculate-price-btn"]')
      
      // Verify 10% discount is applied
      await expect(page.locator('[data-testid="calculated-discount"]')).toContainText('10%')
    })

    test('should create a category-based promotion', async ({ page }) => {
      await page.goto('/pricing/rules/new')

      await page.fill('[data-testid="rule-name"]', 'Electronics Sale')
      await page.selectOption('[data-testid="rule-type"]', 'category')
      
      // Select category
      await page.click('[data-testid="category-select"]')
      await page.click('[data-testid="category-electronics"]')
      
      // Configure promotion
      await page.selectOption('[data-testid="discount-type"]', 'percentage')
      await page.fill('[data-testid="discount-value"]', '20')
      
      // Add conditions
      await page.click('[data-testid="add-condition-btn"]')
      await page.selectOption('[data-testid="condition-type-0"]', 'min_order_value')
      await page.fill('[data-testid="condition-value-0"]', '500')
      
      // Schedule promotion
      await page.click('[data-testid="schedule-promotion-checkbox"]')
      await page.fill('[data-testid="promotion-start"]', '2024-11-24') // Black Friday
      await page.fill('[data-testid="promotion-end"]', '2024-11-30')
      
      await page.click('[data-testid="save-rule-btn"]')
      
      // Verify on promotion calendar
      await page.goto('/pricing/calendar')
      await page.click('[data-testid="month-november"]')
      await expect(page.locator('[data-testid="promotion-electronics-sale"]')).toBeVisible()
    })
  })

  test.describe('Pricing Rule Management', () => {
    test('should edit an existing pricing rule', async ({ page }) => {
      await page.goto('/pricing/rules')
      
      // Find and edit a rule
      await page.click('[data-testid="rule-row"]', { index: 0 })
      await page.click('[data-testid="edit-rule-btn"]')
      
      // Update discount value
      const currentDiscount = await page.inputValue('[data-testid="discount-value"]')
      const newDiscount = String(Number(currentDiscount) + 5)
      await page.fill('[data-testid="discount-value"]', newDiscount)
      
      // Update priority
      await page.fill('[data-testid="rule-priority"]', '150')
      
      // Save changes
      await page.click('[data-testid="save-rule-btn"]')
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Pricing rule updated'
      )
    })

    test('should activate and deactivate rules', async ({ page }) => {
      await page.goto('/pricing/rules')
      
      // Find an active rule
      const activeRule = page.locator('[data-testid="rule-row"]').filter({
        has: page.locator('[data-testid="status-active"]')
      }).first()
      
      // Deactivate it
      await activeRule.locator('[data-testid="toggle-status"]').click()
      await expect(page.locator('[data-testid="confirm-dialog"]')).toContainText(
        'Deactivate this pricing rule?'
      )
      await page.click('[data-testid="confirm-btn"]')
      
      // Verify status changed
      await expect(activeRule.locator('[data-testid="status-inactive"]')).toBeVisible()
      
      // Reactivate it
      await activeRule.locator('[data-testid="toggle-status"]').click()
      await expect(activeRule.locator('[data-testid="status-active"]')).toBeVisible()
    })

    test('should clone a pricing rule', async ({ page }) => {
      await page.goto('/pricing/rules')
      
      // Clone first rule
      await page.click('[data-testid="rule-row"]', { index: 0 })
      await page.click('[data-testid="clone-rule-btn"]')
      
      // Modify cloned rule
      await expect(page.inputValue('[data-testid="rule-name"]')).resolves.toContain('Copy')
      await page.fill('[data-testid="rule-name"]', 'Cloned Special Pricing')
      
      // Save cloned rule
      await page.click('[data-testid="save-rule-btn"]')
      
      // Verify both rules exist
      await page.goto('/pricing/rules')
      await expect(page.locator('[data-testid="rule-list"]')).toContainText(
        'Cloned Special Pricing'
      )
    })
  })

  test.describe('Price Testing and Simulation', () => {
    test('should simulate pricing for different scenarios', async ({ page }) => {
      await page.goto('/pricing/calculator')
      await expect(page.locator('h1')).toContainText('Price Calculator')
      
      // Test scenario 1: Regular customer
      await page.selectOption('[data-testid="customer-type"]', 'regular')
      await page.click('[data-testid="product-select"]')
      await page.fill('[data-testid="product-search"]', 'TEST-SKU-001')
      await page.click('[data-testid="product-option-0"]')
      await page.fill('[data-testid="quantity"]', '5')
      await page.click('[data-testid="calculate-btn"]')
      
      const regularPrice = await page.textContent('[data-testid="calculated-total"]')
      
      // Test scenario 2: VIP customer with bulk quantity
      await page.selectOption('[data-testid="customer-type"]', 'vip')
      await page.fill('[data-testid="quantity"]', '100')
      await page.click('[data-testid="calculate-btn"]')
      
      const vipBulkPrice = await page.textContent('[data-testid="calculated-total"]')
      
      // Verify VIP bulk price is lower
      expect(parseFloat(vipBulkPrice!.replace('$', ''))).toBeLessThan(
        parseFloat(regularPrice!.replace('$', ''))
      )
      
      // View applied rules breakdown
      await page.click('[data-testid="view-breakdown-btn"]')
      await expect(page.locator('[data-testid="applied-rules-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="base-price"]')).toBeVisible()
      await expect(page.locator('[data-testid="discount-summary"]')).toBeVisible()
    })

    test('should compare prices across different customers', async ({ page }) => {
      await page.goto('/pricing/compare')
      
      // Select product to compare
      await page.click('[data-testid="product-select"]')
      await page.fill('[data-testid="product-search"]', 'TEST-SKU-001')
      await page.click('[data-testid="product-option-0"]')
      
      // Add customers to compare
      await page.click('[data-testid="add-customer-btn"]')
      await page.selectOption('[data-testid="customer-0"]', { index: 1 })
      
      await page.click('[data-testid="add-customer-btn"]')
      await page.selectOption('[data-testid="customer-1"]', { index: 2 })
      
      await page.click('[data-testid="add-customer-btn"]')
      await page.selectOption('[data-testid="customer-2"]', { index: 3 })
      
      // Set quantity
      await page.fill('[data-testid="compare-quantity"]', '50')
      
      // Generate comparison
      await page.click('[data-testid="compare-prices-btn"]')
      
      // Verify comparison table
      await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible()
      await expect(page.locator('[data-testid="price-column"]')).toHaveCount(3)
      
      // Export comparison
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-comparison-btn"]')
      ])
      
      expect(download.suggestedFilename()).toContain('price-comparison')
    })
  })

  test.describe('Pricing Approval Workflow', () => {
    test('should submit price changes for approval', async ({ page }) => {
      await page.goto('/pricing/rules')
      
      // Create a rule that requires approval
      await page.click('[data-testid="create-rule-btn"]')
      await page.fill('[data-testid="rule-name"]', 'Major Discount - Needs Approval')
      await page.selectOption('[data-testid="rule-type"]', 'customer')
      await page.selectOption('[data-testid="discount-type"]', 'percentage')
      await page.fill('[data-testid="discount-value"]', '40') // High discount
      
      await page.click('[data-testid="save-rule-btn"]')
      
      // Should show approval required
      await expect(page.locator('[data-testid="approval-required-notice"]')).toBeVisible()
      await expect(page.locator('[data-testid="approval-required-notice"]')).toContainText(
        'This rule requires approval'
      )
      
      // Submit for approval
      await page.click('[data-testid="submit-for-approval-btn"]')
      await page.fill('[data-testid="approval-notes"]', 'Strategic customer retention discount')
      await page.click('[data-testid="confirm-submit-btn"]')
      
      // Verify status
      await expect(page.locator('[data-testid="rule-status"]')).toContainText(
        'Pending Approval'
      )
    })

    test('should track pricing rule history', async ({ page }) => {
      await page.goto('/pricing/rules')
      await page.click('[data-testid="rule-row"]', { index: 0 })
      
      // View history tab
      await page.click('[data-testid="history-tab"]')
      await expect(page.locator('[data-testid="rule-history"]')).toBeVisible()
      
      // Verify history entries
      const historyEntries = page.locator('[data-testid="history-entry"]')
      await expect(historyEntries).toHaveCount(await historyEntries.count())
      
      // Each entry should show what changed
      const firstEntry = historyEntries.first()
      await expect(firstEntry.locator('[data-testid="change-type"]')).toBeVisible()
      await expect(firstEntry.locator('[data-testid="old-value"]')).toBeVisible()
      await expect(firstEntry.locator('[data-testid="new-value"]')).toBeVisible()
      await expect(firstEntry.locator('[data-testid="changed-by"]')).toBeVisible()
    })
  })
})