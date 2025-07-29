import { test, expect } from '@playwright/test'
import { loginUser } from '../helpers/auth'
import { createTestCustomer, deleteTestCustomer } from '../helpers/customers'
import { createTestProduct, deleteTestProduct } from '../helpers/products'

test.describe('Customer Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, 'test@truthsource.io')
  })

  test.describe('Customer Creation and Management', () => {
    test('should create customers with tier assignment', async ({ page }) => {
      await page.goto('/customers')
      
      // Open create dialog
      await page.click('[data-testid="create-customer-btn"]')
      
      // Fill customer details
      await page.fill('[data-testid="customer-name"]', 'Acme Corporation')
      await page.fill('[data-testid="customer-email"]', 'contact@acme.com')
      await page.fill('[data-testid="customer-phone"]', '555-0100')
      await page.selectOption('[data-testid="customer-tier"]', 'gold')
      
      // Add address
      await page.fill('[data-testid="address-line1"]', '123 Business St')
      await page.fill('[data-testid="address-city"]', 'Commerce City')
      await page.fill('[data-testid="address-state"]', 'CA')
      await page.fill('[data-testid="address-zip"]', '90001')
      
      await page.click('[data-testid="save-customer"]')
      
      // Should show in list with tier badge
      await expect(page.getByText('Customer created successfully')).toBeVisible()
      const customerRow = page.locator('[data-testid="customer-row"]').filter({ hasText: 'Acme Corporation' })
      await expect(customerRow).toBeVisible()
      await expect(customerRow.locator('[data-testid="tier-badge-gold"]')).toBeVisible()
    })

    test('should track customer order history and spending', async ({ page }) => {
      await page.goto('/customers')
      
      // Click on a customer
      const customer = page.locator('[data-testid="customer-row"]').first()
      await customer.click()
      
      // Should show customer details
      await expect(page.locator('[data-testid="customer-detail-header"]')).toBeVisible()
      
      // Order history tab
      await page.click('[data-testid="order-history-tab"]')
      await expect(page.locator('[data-testid="order-history-table"]')).toBeVisible()
      
      // Should show lifetime value
      await expect(page.locator('[data-testid="lifetime-value"]')).toBeVisible()
      await expect(page.locator('[data-testid="average-order-value"]')).toBeVisible()
      await expect(page.locator('[data-testid="order-frequency"]')).toBeVisible()
    })

    test('should bulk import customers with validation', async ({ page }) => {
      await page.goto('/customers')
      
      // Open bulk import
      await page.click('[data-testid="bulk-actions"]')
      await page.click('[data-testid="import-customers"]')
      
      // Upload CSV
      const csvContent = `name,email,phone,tier,credit_limit
Big Corp,contact@bigcorp.com,555-0200,platinum,100000
Small Biz,info@smallbiz.com,555-0300,bronze,10000
Big Corp,duplicate@bigcorp.com,555-0201,gold,50000`
      
      const buffer = Buffer.from(csvContent)
      await page.setInputFiles('[data-testid="csv-upload"]', {
        name: 'customers.csv',
        mimeType: 'text/csv',
        buffer,
      })
      
      // Preview should show validation
      await expect(page.locator('[data-testid="import-preview"]')).toBeVisible()
      await expect(page.getByText('2 valid customers')).toBeVisible()
      await expect(page.getByText('1 warning: Duplicate customer name')).toBeVisible()
      
      // Import with merge option
      await page.check('[data-testid="merge-duplicates"]')
      await page.click('[data-testid="import-customers"]')
      
      // Should show progress and complete
      await expect(page.locator('[data-testid="import-progress"]')).toBeVisible()
      await expect(page.getByText('Successfully imported')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Customer Segmentation', () => {
    test('should filter customers by multiple criteria', async ({ page }) => {
      await page.goto('/customers')
      
      // Open advanced filters
      await page.click('[data-testid="filter-btn"]')
      
      // Apply multiple filters
      await page.selectOption('[data-testid="tier-filter"]', 'gold')
      await page.fill('[data-testid="min-spend-filter"]', '10000')
      await page.fill('[data-testid="last-order-days"]', '30')
      await page.click('[data-testid="apply-filters"]')
      
      // Should show filtered results
      const customers = page.locator('[data-testid="customer-row"]')
      const count = await customers.count()
      
      // Verify all shown customers meet criteria
      for (let i = 0; i < count; i++) {
        await expect(customers.nth(i).locator('[data-testid="tier-badge-gold"]')).toBeVisible()
      }
      
      // Save as segment
      await page.click('[data-testid="save-segment-btn"]')
      await page.fill('[data-testid="segment-name"]', 'High Value Active Customers')
      await page.click('[data-testid="save-segment"]')
      
      // Segment should be available in dropdown
      await page.reload()
      await page.click('[data-testid="saved-segments"]')
      await expect(page.getByText('High Value Active Customers')).toBeVisible()
    })
  })
})

test.describe('Pricing Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, 'test@truthsource.io')
  })

  test.describe('Pricing Rules Engine', () => {
    test('should create tiered pricing rules with conditions', async ({ page }) => {
      await page.goto('/pricing/rules')
      
      // Create new rule
      await page.click('[data-testid="create-rule-btn"]')
      
      // Fill rule details
      await page.fill('[data-testid="rule-name"]', 'Volume Discount - Gold Tier')
      await page.selectOption('[data-testid="rule-type"]', 'quantity_break')
      await page.selectOption('[data-testid="customer-tier"]', 'gold')
      
      // Add quantity breaks
      await page.click('[data-testid="add-break"]')
      await page.fill('[data-testid="min-quantity-0"]', '100')
      await page.fill('[data-testid="discount-0"]', '5')
      
      await page.click('[data-testid="add-break"]')
      await page.fill('[data-testid="min-quantity-1"]', '500')
      await page.fill('[data-testid="discount-1"]', '10')
      
      await page.click('[data-testid="add-break"]')
      await page.fill('[data-testid="min-quantity-2"]', '1000')
      await page.fill('[data-testid="discount-2"]', '15')
      
      // Set validity period
      await page.fill('[data-testid="valid-from"]', '2024-01-01')
      await page.fill('[data-testid="valid-to"]', '2024-12-31')
      
      await page.click('[data-testid="save-rule"]')
      
      // Rule should appear in list
      await expect(page.getByText('Pricing rule created')).toBeVisible()
      await expect(page.locator('[data-testid="rule-row"]').filter({ hasText: 'Volume Discount - Gold Tier' })).toBeVisible()
    })

    test('should apply customer-specific pricing overrides', async ({ page }) => {
      await page.goto('/customers')
      
      // Select a customer
      const customer = page.locator('[data-testid="customer-row"]').first()
      await customer.click()
      
      // Go to pricing tab
      await page.click('[data-testid="pricing-tab"]')
      
      // Add custom price for product
      await page.click('[data-testid="add-custom-price"]')
      await page.click('[data-testid="product-search"]')
      await page.fill('[data-testid="product-search"]', 'WIDGET-001')
      await page.click('[data-testid="product-option-WIDGET-001"]')
      
      await page.fill('[data-testid="custom-price"]', '249.99')
      await page.fill('[data-testid="price-reason"]', 'Negotiated contract price')
      await page.fill('[data-testid="price-valid-from"]', '2024-01-01')
      await page.fill('[data-testid="price-valid-to"]', '2024-12-31')
      
      await page.click('[data-testid="save-custom-price"]')
      
      // Should show in customer pricing list
      await expect(page.locator('[data-testid="custom-price-row"]').filter({ hasText: 'WIDGET-001' })).toBeVisible()
      await expect(page.getByText('$249.99')).toBeVisible()
    })

    test('should calculate prices with multiple rules applied', async ({ page }) => {
      await page.goto('/pricing/calculator')
      
      // Select customer and product
      await page.click('[data-testid="customer-select"]')
      await page.fill('[data-testid="customer-search"]', 'Acme')
      await page.click('[data-testid="customer-option-acme"]')
      
      await page.click('[data-testid="product-select"]')
      await page.fill('[data-testid="product-search"]', 'WIDGET-001')
      await page.click('[data-testid="product-option-WIDGET-001"]')
      
      // Enter quantity
      await page.fill('[data-testid="quantity-input"]', '500')
      
      // Calculate price
      await page.click('[data-testid="calculate-price"]')
      
      // Should show price breakdown
      await expect(page.locator('[data-testid="price-calculation"]')).toBeVisible()
      await expect(page.getByText('Base Price:')).toBeVisible()
      await expect(page.getByText('Volume Discount:')).toBeVisible()
      await expect(page.getByText('Customer Tier Discount:')).toBeVisible()
      await expect(page.getByText('Final Price:')).toBeVisible()
      
      // Should show applied rules
      await expect(page.locator('[data-testid="applied-rules"]')).toBeVisible()
      await expect(page.getByText('Volume Discount - Gold Tier')).toBeVisible()
    })
  })

  test.describe('Promotion Management', () => {
    test('should create time-based promotions', async ({ page }) => {
      await page.goto('/pricing/rules')
      
      // Create promotion
      await page.click('[data-testid="create-rule-btn"]')
      await page.selectOption('[data-testid="rule-type"]', 'promotion')
      
      await page.fill('[data-testid="rule-name"]', 'Black Friday Sale')
      await page.fill('[data-testid="discount-percentage"]', '25')
      
      // Set date range
      await page.fill('[data-testid="valid-from"]', '2024-11-29')
      await page.fill('[data-testid="valid-to"]', '2024-11-29')
      
      // Add product categories
      await page.click('[data-testid="add-category"]')
      await page.selectOption('[data-testid="category-select"]', 'electronics')
      
      // Add minimum order value
      await page.fill('[data-testid="min-order-value"]', '500')
      
      await page.click('[data-testid="save-rule"]')
      
      // Should appear in promotion calendar
      await page.goto('/pricing/calendar')
      await page.click('[data-testid="month-november"]')
      await expect(page.getByText('Black Friday Sale')).toBeVisible()
    })

    test('should handle overlapping pricing rules correctly', async ({ page }) => {
      await page.goto('/pricing/calculator')
      
      // Set up scenario with multiple applicable rules
      await page.click('[data-testid="customer-select"]')
      await page.fill('[data-testid="customer-search"]', 'Acme')
      await page.click('[data-testid="customer-option-acme"]')
      
      await page.click('[data-testid="product-select"]')
      await page.fill('[data-testid="product-search"]', 'WIDGET-001')
      await page.click('[data-testid="product-option-WIDGET-001"]')
      
      await page.fill('[data-testid="quantity-input"]', '1000')
      await page.fill('[data-testid="order-date"]', '2024-11-29') // Black Friday
      
      await page.click('[data-testid="calculate-price"]')
      
      // Should show conflict resolution
      await expect(page.locator('[data-testid="rule-conflicts"]')).toBeVisible()
      await expect(page.getByText('Multiple rules apply')).toBeVisible()
      
      // Should use best price for customer
      await expect(page.getByText('Best price selected')).toBeVisible()
      await expect(page.locator('[data-testid="selected-rule"]')).toContainText('Black Friday Sale')
    })
  })

  test.describe('Contract Pricing', () => {
    test('should create customer contracts with specific terms', async ({ page }) => {
      await page.goto('/customers')
      
      // Select customer
      const customer = page.locator('[data-testid="customer-row"]').filter({ hasText: 'Acme Corporation' })
      await customer.click()
      
      // Go to contracts tab
      await page.click('[data-testid="contracts-tab"]')
      await page.click('[data-testid="create-contract"]')
      
      // Fill contract details
      await page.fill('[data-testid="contract-name"]', '2024 Annual Agreement')
      await page.fill('[data-testid="contract-start"]', '2024-01-01')
      await page.fill('[data-testid="contract-end"]', '2024-12-31')
      
      // Add contract items
      await page.click('[data-testid="add-contract-item"]')
      await page.selectOption('[data-testid="product-select-0"]', 'WIDGET-001')
      await page.fill('[data-testid="contract-price-0"]', '225.00')
      await page.fill('[data-testid="min-quantity-0"]', '100')
      await page.fill('[data-testid="max-quantity-0"]', '5000')
      
      // Add volume commitment
      await page.fill('[data-testid="annual-commitment"]', '250000')
      await page.fill('[data-testid="penalty-percentage"]', '5')
      
      await page.click('[data-testid="save-contract"]')
      
      // Contract should be active
      await expect(page.getByText('Contract created')).toBeVisible()
      await expect(page.locator('[data-testid="contract-status"]')).toContainText('Active')
    })

    test('should track contract performance and commitments', async ({ page }) => {
      await page.goto('/customers')
      
      // Navigate to customer with contract
      const customer = page.locator('[data-testid="customer-row"]').filter({ hasText: 'Acme Corporation' })
      await customer.click()
      
      await page.click('[data-testid="contracts-tab"]')
      await page.click('[data-testid="contract-row"]').first()
      
      // Should show contract performance
      await expect(page.locator('[data-testid="contract-performance"]')).toBeVisible()
      await expect(page.locator('[data-testid="commitment-progress"]')).toBeVisible()
      await expect(page.getByText('YTD Spending:')).toBeVisible()
      await expect(page.getByText('Commitment Status:')).toBeVisible()
      
      // Should show projected vs actual
      await expect(page.locator('[data-testid="projection-chart"]')).toBeVisible()
      await expect(page.getByText('On Track')).toBeVisible()
    })
  })

  test.describe('Price History and Auditing', () => {
    test('should maintain complete price change history', async ({ page }) => {
      await page.goto('/pricing/history')
      
      // Filter by product
      await page.click('[data-testid="product-filter"]')
      await page.fill('[data-testid="product-search"]', 'WIDGET-001')
      await page.click('[data-testid="product-option-WIDGET-001"]')
      
      // Should show price timeline
      await expect(page.locator('[data-testid="price-timeline"]')).toBeVisible()
      
      // Each change should show details
      const priceChanges = page.locator('[data-testid="price-change-entry"]')
      const firstChange = priceChanges.first()
      
      await expect(firstChange.locator('[data-testid="old-price"]')).toBeVisible()
      await expect(firstChange.locator('[data-testid="new-price"]')).toBeVisible()
      await expect(firstChange.locator('[data-testid="change-reason"]')).toBeVisible()
      await expect(firstChange.locator('[data-testid="changed-by"]')).toBeVisible()
      await expect(firstChange.locator('[data-testid="change-date"]')).toBeVisible()
    })

    test('should export pricing data for analysis', async ({ page }) => {
      await page.goto('/pricing')
      
      // Open export dialog
      await page.click('[data-testid="export-pricing"]')
      
      // Select export options
      await page.check('[data-testid="include-base-prices"]')
      await page.check('[data-testid="include-customer-prices"]')
      await page.check('[data-testid="include-rules"]')
      await page.check('[data-testid="include-history"]')
      
      await page.selectOption('[data-testid="date-range"]', 'last_90_days')
      
      await page.click('[data-testid="export-data"]')
      
      // Should download file
      const download = await page.waitForEvent('download')
      expect(download.suggestedFilename()).toMatch(/pricing_export_.*\.xlsx/)
      
      // Should log export
      await page.goto('/audit')
      await expect(page.getByText('Exported pricing data')).toBeVisible()
    })
  })
})