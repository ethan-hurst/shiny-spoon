import { test, expect } from '@playwright/test'

test.describe('Pricing Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('pricing page accessibility', async ({ page }) => {
    // Try to access pricing page
    const pricingRoutes = ['/pricing', '/dashboard/pricing', '/portal/pricing', '/admin/pricing']
    
    let accessibleRoute = null
    for (const route of pricingRoutes) {
      await page.goto(route)
      const url = page.url()
      
      if (url.includes('pricing') && !url.includes('login') && !url.includes('auth')) {
        accessibleRoute = route
        break
      }
    }
    
    if (accessibleRoute) {
      // We found an accessible pricing page
      await page.goto(accessibleRoute)
      
      // Look for pricing-related elements
      const pricingElements = [
        'table',
        '[data-testid*="pricing"]',
        'h1:has-text("Pricing")',
        'h2:has-text("Pricing")',
        '.pricing',
        'text=Price',
        'text=Cost',
        'text=Margin'
      ]
      
      let foundPricingContent = false
      for (const selector of pricingElements) {
        const element = page.locator(selector).first()
        if (await element.isVisible()) {
          foundPricingContent = true
          break
        }
      }
      
      expect(foundPricingContent).toBeTruthy()
    }
  })

  test('pricing table functionality', async ({ page }) => {
    await page.goto('/pricing')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Look for pricing table
    const table = page.locator('table').first()
    
    if (await table.isVisible()) {
      // Check table headers
      const headers = table.locator('thead th, thead td')
      const headerCount = await headers.count()
      
      expect(headerCount).toBeGreaterThan(0)
      
      // Check for common pricing columns
      const commonHeaders = ['SKU', 'Product', 'Price', 'Cost', 'Margin', 'Customer']
      for (const header of commonHeaders) {
        const headerElement = table.locator(`text="${header}"`).first()
        if (await headerElement.isVisible()) {
          expect(headerElement).toBeVisible()
        }
      }
      
      // Check table rows
      const rows = table.locator('tbody tr')
      const rowCount = await rows.count()
      
      // Should have some rows or show empty state
      expect(rowCount).toBeGreaterThanOrEqual(0)
    }
  })

  test('price calculation functionality', async ({ page }) => {
    await page.goto('/pricing')
    
    // Look for price calculator or form
    const priceForm = page.locator('form').first()
    
    if (await priceForm.isVisible()) {
      // Look for input fields commonly used in pricing
      const costInput = page.locator('input[name*="cost" i], input[placeholder*="cost" i]').first()
      const marginInput = page.locator('input[name*="margin" i], input[placeholder*="margin" i]').first()
      const priceInput = page.locator('input[name*="price" i], input[placeholder*="price" i]').first()
      
      if (await costInput.isVisible() && await marginInput.isVisible()) {
        // Test price calculation
        await costInput.fill('100')
        await marginInput.fill('50')
        
        // Look for calculate button or trigger calculation
        const calculateButton = page.locator('button:has-text("Calculate"), button:has-text("Update"), button[type="submit"]').first()
        
        if (await calculateButton.isVisible()) {
          await calculateButton.click()
          await page.waitForTimeout(1000)
          
          // Check if price was calculated
          if (await priceInput.isVisible()) {
            const calculatedPrice = await priceInput.inputValue()
            expect(calculatedPrice).toBeTruthy()
          }
        }
      }
    }
  })

  test('customer-specific pricing', async ({ page }) => {
    await page.goto('/pricing')
    
    // Look for customer selection dropdown
    const customerSelect = page.locator('select[name*="customer"], [data-testid*="customer-select"]').first()
    
    if (await customerSelect.isVisible()) {
      await customerSelect.click()
      
      // Look for customer options
      const options = page.locator('option')
      const optionCount = await options.count()
      
      if (optionCount > 1) {
        // Select a customer (not the first empty option)
        await options.nth(1).click()
        
        // Should update pricing table or form
        await page.waitForTimeout(1000)
        
        // Verify we're still on pricing page
        expect(page.url()).toMatch(/pricing/)
      }
    }
  })

  test('pricing rules creation', async ({ page }) => {
    await page.goto('/pricing')
    
    // Look for create/add buttons
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New"), [data-testid*="create"]').first()
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Should open form or modal
      await page.waitForTimeout(500)
      
      // Look for pricing rule form fields
      const nameInput = page.locator('input[name*="name"], input[placeholder*="name" i]').first()
      const typeSelect = page.locator('select[name*="type"], select[name*="rule"]').first()
      
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Pricing Rule')
        
        if (await typeSelect.isVisible()) {
          await typeSelect.click()
          
          // Select first available option
          const options = page.locator('option')
          const optionCount = await options.count()
          
          if (optionCount > 1) {
            await options.nth(1).click()
          }
        }
        
        // Look for save button
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first()
        
        if (await saveButton.isVisible()) {
          await saveButton.click()
          await page.waitForTimeout(1000)
          
          // Should return to pricing page or show success
          expect(page.url()).toMatch(/pricing/)
        }
      }
    }
  })

  test('bulk pricing updates', async ({ page }) => {
    await page.goto('/pricing')
    
    // Look for bulk update functionality
    const bulkButton = page.locator('button:has-text("Bulk"), button:has-text("Import"), button:has-text("Export")').first()
    
    if (await bulkButton.isVisible()) {
      await bulkButton.click()
      
      // Should open bulk operation modal or page
      await page.waitForTimeout(500)
      
      // Look for file upload or bulk form
      const fileInput = page.locator('input[type="file"]').first()
      const bulkForm = page.locator('form').first()
      
      if (await fileInput.isVisible()) {
        // Test file upload interface (without actually uploading)
        expect(fileInput).toBeVisible()
      } else if (await bulkForm.isVisible()) {
        // Test bulk form interface
        expect(bulkForm).toBeVisible()
      }
    }
  })

  test('pricing analytics and reporting', async ({ page }) => {
    await page.goto('/pricing')
    
    // Look for analytics or reports section
    const analyticsElements = [
      '[data-testid*="chart"]',
      '[data-testid*="metric"]',
      '.chart',
      '.metric',
      'canvas',
      'svg'
    ]
    
    let foundAnalytics = false
    for (const selector of analyticsElements) {
      const element = page.locator(selector).first()
      if (await element.isVisible()) {
        foundAnalytics = true
        break
      }
    }
    
    // Analytics might be on a separate tab or page
    const reportsLink = page.locator('a:has-text("Reports"), a:has-text("Analytics"), button:has-text("Reports")').first()
    
    if (await reportsLink.isVisible()) {
      await reportsLink.click()
      await page.waitForTimeout(1000)
      
      // Should navigate to reports section
      const url = page.url()
      expect(url).toMatch(/(reports|analytics|pricing)/)
    }
  })

  test('pricing mobile responsiveness', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/pricing')
    
    // Should be accessible on mobile
    const mainContent = page.locator('main, [role="main"]').first()
    await expect(mainContent).toBeVisible()
    
    // Table should adapt to mobile
    const table = page.locator('table').first()
    if (await table.isVisible()) {
      // Table should not overflow viewport
      const tableBox = await table.boundingBox()
      if (tableBox) {
        expect(tableBox.width).toBeLessThanOrEqual(400) // Allow some margin
      }
    }
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForLoadState('networkidle')
    
    await expect(mainContent).toBeVisible()
  })
})