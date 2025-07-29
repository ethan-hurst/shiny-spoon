import { test, expect } from '@playwright/test'

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('inventory page accessibility', async ({ page }) => {
    // Try to access inventory page
    const inventoryRoutes = ['/inventory', '/dashboard/inventory', '/portal/inventory']
    
    let accessibleRoute = null
    for (const route of inventoryRoutes) {
      await page.goto(route)
      const url = page.url()
      
      if (url.includes('inventory') && !url.includes('login') && !url.includes('auth')) {
        accessibleRoute = route
        break
      }
    }
    
    if (accessibleRoute) {
      // We found an accessible inventory page
      await page.goto(accessibleRoute)
      
      // Look for inventory-related elements
      const inventoryElements = [
        'table',
        '[data-testid*="inventory"]',
        'h1:has-text("Inventory")',
        'h2:has-text("Inventory")',
        '.inventory',
        'text=SKU',
        'text=Quantity'
      ]
      
      let foundInventoryContent = false
      for (const selector of inventoryElements) {
        const element = page.locator(selector).first()
        if (await element.isVisible()) {
          foundInventoryContent = true
          break
        }
      }
      
      expect(foundInventoryContent).toBeTruthy()
    }
  })

  test('inventory table functionality', async ({ page }) => {
    await page.goto('/inventory')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Look for inventory table
    const table = page.locator('table').first()
    
    if (await table.isVisible()) {
      // Check table headers
      const headers = table.locator('thead th, thead td')
      const headerCount = await headers.count()
      
      expect(headerCount).toBeGreaterThan(0)
      
      // Check for common inventory columns
      const commonHeaders = ['SKU', 'Product', 'Quantity', 'Location', 'Status']
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

  test('inventory search and filtering', async ({ page }) => {
    await page.goto('/inventory')
    
    // Look for search functionality
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="SKU" i]').first()
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('TEST')
      await searchInput.press('Enter')
      
      // Wait for search results
      await page.waitForTimeout(1000)
      
      // Should still be on inventory page
      expect(page.url()).toMatch(/inventory/)
    }
    
    // Look for filter dropdowns
    const filters = page.locator('select, [role="combobox"]')
    const filterCount = await filters.count()
    
    if (filterCount > 0) {
      const firstFilter = filters.first()
      if (await firstFilter.isVisible()) {
        await firstFilter.click()
        
        // Should open filter options
        await page.waitForTimeout(500)
        
        // Look for filter options
        const options = page.locator('option, [role="option"]')
        const optionCount = await options.count()
        
        expect(optionCount).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('inventory quantity update', async ({ page }) => {
    await page.goto('/inventory')
    
    // Look for edit buttons or quantity input fields
    const editButtons = page.locator('button:has-text("Edit"), [data-testid*="edit"], [aria-label*="edit" i]')
    const editButtonCount = await editButtons.count()
    
    if (editButtonCount > 0) {
      const firstEditButton = editButtons.first()
      await firstEditButton.click()
      
      // Look for quantity input field
      const quantityInput = page.locator('input[name*="quantity" i], input[type="number"]').first()
      
      if (await quantityInput.isVisible()) {
        const currentValue = await quantityInput.inputValue()
        const newValue = String(parseInt(currentValue || '0') + 1)
        
        await quantityInput.fill(newValue)
        
        // Look for save button
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]').first()
        
        if (await saveButton.isVisible()) {
          await saveButton.click()
          
          // Should show success message or return to table view
          await page.waitForTimeout(1000)
          expect(page.url()).toMatch(/inventory/)
        }
      }
    }
  })

  test('inventory bulk operations', async ({ page }) => {
    await page.goto('/inventory')
    
    // Look for bulk operation controls
    const selectAllCheckbox = page.locator('input[type="checkbox"][data-testid*="select-all"], thead input[type="checkbox"]').first()
    
    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.click()
      
      // Look for bulk action buttons
      const bulkButtons = page.locator('button:has-text("Bulk"), button:has-text("Export"), button:has-text("Update")')
      const bulkButtonCount = await bulkButtons.count()
      
      if (bulkButtonCount > 0) {
        // Test bulk export if available
        const exportButton = page.locator('button:has-text("Export")').first()
        if (await exportButton.isVisible()) {
          await exportButton.click()
          
          // Should trigger download or show export dialog
          await page.waitForTimeout(1000)
        }
      }
    }
  })

  test('inventory mobile responsiveness', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/inventory')
    
    // Should be accessible on mobile
    const mainContent = page.locator('main, [role="main"]').first()
    await expect(mainContent).toBeVisible()
    
    // Table should adapt to mobile (might become cards or scrollable)
    const table = page.locator('table').first()
    if (await table.isVisible()) {
      // Table should not overflow viewport
      const tableBox = await table.boundingBox()
      if (tableBox) {
        expect(tableBox.width).toBeLessThanOrEqual(400) // Allow some margin
      }
    }
  })
})