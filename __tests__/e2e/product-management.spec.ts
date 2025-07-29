import { test, expect } from '@playwright/test'
import { loginUser } from '../helpers/auth'
import { createTestProduct, deleteTestProduct } from '../helpers/products'

test.describe('Product Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, 'test@truthsource.io')
  })

  test.describe('Product Creation', () => {
    test('should create products with proper validation', async ({ page }) => {
      await page.goto('/products')
      
      // Open create dialog
      await page.click('[data-testid="create-product-btn"]')
      
      // Validation should prevent submission with empty fields
      await page.click('[data-testid="submit-product"]')
      await expect(page.getByText('SKU is required')).toBeVisible()
      await expect(page.getByText('Name is required')).toBeVisible()
      await expect(page.getByText('Base price is required')).toBeVisible()
      
      // Fill in product details
      await page.fill('[data-testid="sku-input"]', 'WIDGET-001')
      await page.fill('[data-testid="name-input"]', 'Premium Widget')
      await page.fill('[data-testid="description-input"]', 'High-quality industrial widget')
      await page.fill('[data-testid="base-price-input"]', '299.99')
      await page.fill('[data-testid="cost-input"]', '150.00')
      await page.selectOption('[data-testid="category-select"]', 'industrial')
      
      // Submit
      await page.click('[data-testid="submit-product"]')
      
      // Should show success and add to list
      await expect(page.getByText('Product created successfully')).toBeVisible()
      await expect(page.locator('[data-testid="product-row"]').filter({ hasText: 'WIDGET-001' })).toBeVisible()
    })

    test('should prevent duplicate SKUs', async ({ page }) => {
      await page.goto('/products')
      
      // Try to create product with existing SKU
      await page.click('[data-testid="create-product-btn"]')
      await page.fill('[data-testid="sku-input"]', 'WIDGET-001') // Already exists from previous test
      await page.fill('[data-testid="name-input"]', 'Another Widget')
      await page.fill('[data-testid="base-price-input"]', '199.99')
      
      await page.click('[data-testid="submit-product"]')
      
      // Should show error
      await expect(page.getByText('SKU already exists')).toBeVisible()
    })

    test('should auto-calculate margin percentage', async ({ page }) => {
      await page.goto('/products')
      await page.click('[data-testid="create-product-btn"]')
      
      // Enter cost and price
      await page.fill('[data-testid="cost-input"]', '100')
      await page.fill('[data-testid="base-price-input"]', '150')
      
      // Margin should auto-calculate
      await expect(page.locator('[data-testid="margin-display"]')).toHaveText('33.33%')
      
      // Change price
      await page.fill('[data-testid="base-price-input"]', '200')
      await expect(page.locator('[data-testid="margin-display"]')).toHaveText('50.00%')
    })
  })

  test.describe('Bulk Product Operations', () => {
    test('should import products from CSV with validation', async ({ page }) => {
      await page.goto('/products')
      
      // Open bulk import
      await page.click('[data-testid="bulk-actions-btn"]')
      await page.click('[data-testid="bulk-import"]')
      
      // Upload CSV file
      const csvContent = `sku,name,description,base_price,cost,category
BULK-001,Bulk Product 1,Description 1,99.99,50,industrial
BULK-002,Bulk Product 2,Description 2,149.99,75,electronics
BULK-001,Duplicate SKU,Should fail,199.99,100,industrial`
      
      const buffer = Buffer.from(csvContent)
      await page.setInputFiles('[data-testid="csv-upload"]', {
        name: 'products.csv',
        mimeType: 'text/csv',
        buffer,
      })
      
      // Preview should show validation results
      await expect(page.locator('[data-testid="import-preview"]')).toBeVisible()
      await expect(page.getByText('2 valid products')).toBeVisible()
      await expect(page.getByText('1 error: Duplicate SKU')).toBeVisible()
      
      // Import valid products only
      await page.click('[data-testid="import-valid-only"]')
      
      // Should show progress
      await expect(page.locator('[data-testid="import-progress"]')).toBeVisible()
      await expect(page.getByText('Importing 2 products...')).toBeVisible()
      
      // Should complete
      await expect(page.getByText('Successfully imported 2 products')).toBeVisible({ timeout: 10000 })
      
      // Verify products were added
      await expect(page.locator('[data-testid="product-row"]').filter({ hasText: 'BULK-001' })).toBeVisible()
      await expect(page.locator('[data-testid="product-row"]').filter({ hasText: 'BULK-002' })).toBeVisible()
    })

    test('should export products with filters', async ({ page }) => {
      await page.goto('/products')
      
      // Apply filters
      await page.click('[data-testid="filter-btn"]')
      await page.selectOption('[data-testid="category-filter"]', 'industrial')
      await page.check('[data-testid="active-only-filter"]')
      await page.click('[data-testid="apply-filters"]')
      
      // Export filtered results
      await page.click('[data-testid="bulk-actions-btn"]')
      await page.click('[data-testid="export-csv"]')
      
      // Should download file
      const download = await page.waitForEvent('download')
      expect(download.suggestedFilename()).toMatch(/products_export_.*\.csv/)
      
      // Verify export logged
      await page.goto('/settings/audit-log')
      await expect(page.getByText('Exported products')).toBeVisible()
    })

    test('should bulk update prices with percentage adjustment', async ({ page }) => {
      await page.goto('/products')
      
      // Select multiple products
      await page.check('[data-testid="select-all"]')
      
      // Open bulk price update
      await page.click('[data-testid="bulk-actions-btn"]')
      await page.click('[data-testid="bulk-update-prices"]')
      
      // Set percentage increase
      await page.selectOption('[data-testid="price-adjustment-type"]', 'percentage')
      await page.fill('[data-testid="adjustment-value"]', '10')
      await page.fill('[data-testid="adjustment-reason"]', 'Annual price increase')
      
      // Preview changes
      await page.click('[data-testid="preview-changes"]')
      await expect(page.locator('[data-testid="price-preview-table"]')).toBeVisible()
      await expect(page.getByText('Current → New')).toBeVisible()
      
      // Apply changes
      await page.click('[data-testid="apply-price-changes"]')
      
      // Should show progress
      await expect(page.locator('[data-testid="update-progress"]')).toBeVisible()
      await expect(page.getByText('Updated 0 of')).toBeVisible()
      
      // Should complete
      await expect(page.getByText('Successfully updated prices')).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Product Search and Filtering', () => {
    test('should search products across multiple fields', async ({ page }) => {
      await page.goto('/products')
      
      // Search by SKU
      await page.fill('[data-testid="product-search"]', 'WIDGET-001')
      await page.waitForTimeout(300) // Debounce
      
      const results = page.locator('[data-testid="product-row"]')
      await expect(results).toHaveCount(1)
      await expect(results.first()).toContainText('WIDGET-001')
      
      // Search by name
      await page.fill('[data-testid="product-search"]', 'Premium')
      await page.waitForTimeout(300)
      
      await expect(results.first()).toContainText('Premium Widget')
      
      // Search by description
      await page.fill('[data-testid="product-search"]', 'industrial')
      await page.waitForTimeout(300)
      
      const count = await results.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should maintain filter state in URL', async ({ page }) => {
      await page.goto('/products')
      
      // Apply multiple filters
      await page.click('[data-testid="filter-btn"]')
      await page.selectOption('[data-testid="category-filter"]', 'electronics')
      await page.check('[data-testid="active-only-filter"]')
      await page.fill('[data-testid="min-price-filter"]', '100')
      await page.fill('[data-testid="max-price-filter"]', '500')
      await page.click('[data-testid="apply-filters"]')
      
      // URL should update
      await expect(page).toHaveURL(/category=electronics/)
      await expect(page).toHaveURL(/active=true/)
      await expect(page).toHaveURL(/min_price=100/)
      await expect(page).toHaveURL(/max_price=500/)
      
      // Reload page
      await page.reload()
      
      // Filters should persist
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('Category: Electronics')
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('Active Only')
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('Price: $100 - $500')
    })
  })

  test.describe('Product Variants', () => {
    test('should manage product variants with inventory tracking', async ({ page }) => {
      await page.goto('/products')
      
      // Open product details
      const product = page.locator('[data-testid="product-row"]').first()
      await product.click()
      
      // Add variant
      await page.click('[data-testid="add-variant-btn"]')
      
      // Fill variant details
      await page.fill('[data-testid="variant-sku"]', 'WIDGET-001-LG')
      await page.fill('[data-testid="variant-name"]', 'Large')
      await page.fill('[data-testid="variant-price-adjustment"]', '50')
      
      // Add variant attributes
      await page.click('[data-testid="add-attribute"]')
      await page.fill('[data-testid="attribute-name-0"]', 'Size')
      await page.fill('[data-testid="attribute-value-0"]', 'Large')
      
      await page.click('[data-testid="save-variant"]')
      
      // Variant should appear in list
      await expect(page.locator('[data-testid="variant-row"]').filter({ hasText: 'WIDGET-001-LG' })).toBeVisible()
      await expect(page.getByText('$349.99')).toBeVisible() // Base price + adjustment
      
      // Each variant should have separate inventory
      await page.click('[data-testid="variant-inventory-btn"]')
      await expect(page.locator('[data-testid="variant-inventory-modal"]')).toBeVisible()
      await expect(page.getByText('Inventory by Warehouse')).toBeVisible()
    })
  })

  test.describe('Product Integration Sync', () => {
    test('should sync product changes to connected platforms', async ({ page }) => {
      await page.goto('/products')
      
      // Edit a product
      const product = page.locator('[data-testid="product-row"]').first()
      await product.locator('[data-testid="edit-product"]').click()
      
      // Change price
      await page.fill('[data-testid="base-price-input"]', '399.99')
      await page.click('[data-testid="save-product"]')
      
      // Should trigger sync
      await expect(page.locator('[data-testid="sync-indicator"]')).toBeVisible()
      await expect(page.getByText('Syncing to Shopify...')).toBeVisible()
      await expect(page.getByText('Syncing to NetSuite...')).toBeVisible()
      
      // Sync should complete
      await expect(page.getByText('Sync completed')).toBeVisible({ timeout: 10000 })
      
      // Verify sync status
      await product.locator('[data-testid="sync-status"]').click()
      await expect(page.getByText('Last synced:')).toBeVisible()
      await expect(page.getByText('Shopify: Success')).toBeVisible()
      await expect(page.getByText('NetSuite: Success')).toBeVisible()
    })

    test('should handle sync conflicts gracefully', async ({ page }) => {
      await page.goto('/products')
      
      // Simulate external change (dev tool)
      await page.click('[data-testid="dev-tools-btn"]')
      await page.click('[data-testid="simulate-external-change"]')
      
      // Edit same product locally
      const product = page.locator('[data-testid="product-row"]').first()
      await product.locator('[data-testid="edit-product"]').click()
      await page.fill('[data-testid="base-price-input"]', '299.99')
      await page.click('[data-testid="save-product"]')
      
      // Conflict dialog should appear
      await expect(page.locator('[data-testid="sync-conflict-dialog"]')).toBeVisible()
      await expect(page.getByText('Sync Conflict Detected')).toBeVisible()
      
      // Should show both values
      await expect(page.getByText('Local: $299.99')).toBeVisible()
      await expect(page.getByText('Shopify: $349.99')).toBeVisible()
      
      // Resolve conflict
      await page.click('[data-testid="use-local-value"]')
      await page.click('[data-testid="resolve-and-sync"]')
      
      // Should sync successfully
      await expect(page.getByText('Conflict resolved and synced')).toBeVisible()
    })
  })

  test.describe('Product Categories', () => {
    test('should manage product categories hierarchically', async ({ page }) => {
      await page.goto('/products/categories')
      
      // Create parent category
      await page.click('[data-testid="create-category-btn"]')
      await page.fill('[data-testid="category-name"]', 'Electronics')
      await page.fill('[data-testid="category-description"]', 'Electronic products and components')
      await page.click('[data-testid="save-category"]')
      
      // Create sub-category
      await page.click('[data-testid="create-category-btn"]')
      await page.fill('[data-testid="category-name"]', 'Computers')
      await page.selectOption('[data-testid="parent-category"]', 'Electronics')
      await page.click('[data-testid="save-category"]')
      
      // Should show hierarchy
      await expect(page.locator('[data-testid="category-tree"]')).toContainText('Electronics')
      await expect(page.locator('[data-testid="category-tree"] [data-testid="subcategory"]')).toContainText('Computers')
      
      // Assign products to category
      await page.goto('/products')
      await page.check('[data-testid="select-all"]')
      await page.click('[data-testid="bulk-actions-btn"]')
      await page.click('[data-testid="bulk-assign-category"]')
      await page.selectOption('[data-testid="category-select"]', 'Computers')
      await page.click('[data-testid="assign-category"]')
      
      // Products should show category
      await expect(page.locator('[data-testid="product-category"]').first()).toContainText('Electronics > Computers')
    })
  })
})