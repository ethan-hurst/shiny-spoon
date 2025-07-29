import { test, expect } from '@playwright/test'

test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('dashboard page structure', async ({ page }) => {
    // Try to access dashboard
    await page.goto('/dashboard')
    
    // Check if we can access dashboard or are redirected
    const url = page.url()
    
    if (url.includes('/dashboard')) {
      // We're on dashboard, check for typical dashboard elements
      const possibleElements = [
        'main',
        '[data-testid="dashboard"]',
        'h1, h2, h3',
        '.dashboard',
        '#dashboard'
      ]
      
      let foundDashboard = false
      for (const selector of possibleElements) {
        const element = page.locator(selector).first()
        if (await element.isVisible()) {
          foundDashboard = true
          break
        }
      }
      
      expect(foundDashboard).toBeTruthy()
    } else {
      // Redirected away from dashboard (likely due to auth)
      expect(url).toMatch(/\/(login|auth|$)/)
    }
  })

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Look for sidebar or navigation elements
    const sidebar = page.locator('aside, nav, [data-testid="sidebar"], .sidebar').first()
    
    if (await sidebar.isVisible()) {
      // Look for navigation links
      const navLinks = sidebar.locator('a')
      const linkCount = await navLinks.count()
      
      if (linkCount > 0) {
        // Test clicking first few navigation links
        for (let i = 0; i < Math.min(3, linkCount); i++) {
          const link = navLinks.nth(i)
          const href = await link.getAttribute('href')
          
          if (href && !href.startsWith('#')) {
            await link.click()
            await page.waitForLoadState('networkidle')
            
            // Should navigate to new page
            expect(page.url()).toContain(href)
            
            // Go back to dashboard for next test
            await page.goto('/dashboard')
          }
        }
      }
    }
  })

  test('responsive dashboard layout', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForLoadState('networkidle')
    
    // Dashboard should still be accessible
    const mainContent = page.locator('main, [role="main"], .main-content').first()
    await expect(mainContent).toBeVisible()
    
    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForLoadState('networkidle')
    
    await expect(mainContent).toBeVisible()
  })

  test('dashboard data loading', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Wait for potential loading states to complete
    await page.waitForLoadState('networkidle')
    
    // Look for common dashboard elements
    const commonElements = [
      'table',
      '.chart',
      '.metric',
      '.card',
      '[data-testid*="chart"]',
      '[data-testid*="metric"]',
      '[data-testid*="table"]'
    ]
    
    let foundDashboardContent = false
    for (const selector of commonElements) {
      const elements = page.locator(selector)
      const count = await elements.count()
      if (count > 0) {
        foundDashboardContent = true
        break
      }
    }
    
    // Either we have dashboard content or we're not on the dashboard due to auth
    const url = page.url()
    if (url.includes('/dashboard')) {
      expect(foundDashboardContent).toBeTruthy()
    }
  })

  test('search functionality', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], [data-testid="search"]').first()
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test search')
      await searchInput.press('Enter')
      
      // Should trigger some kind of search result or loading state
      await page.waitForTimeout(1000) // Give time for search to process
      
      // Check that we're still on a valid page
      const url = page.url()
      expect(url).toMatch(/\/(dashboard|search)/)
    }
  })
})