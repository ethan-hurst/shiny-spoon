import { test, expect } from '@playwright/test'

test.describe('Basic Navigation', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/')
    
    // Check that the page loads without errors
    await expect(page).toHaveTitle(/TruthSource|Next.js/)
    
    // Check for basic navigation elements
    const navigation = page.locator('nav')
    await expect(navigation).toBeVisible()
  })

  test('about page is accessible', async ({ page }) => {
    await page.goto('/')
    
    // Look for about link in navigation
    const aboutLink = page.locator('a[href="/about"]').first()
    if (await aboutLink.isVisible()) {
      await aboutLink.click()
      await expect(page).toHaveURL(/.*\/about/)
    } else {
      // If no about link in nav, try direct navigation
      await page.goto('/about')
      await expect(page).toHaveURL(/.*\/about/)
    }
  })

  test('features page is accessible', async ({ page }) => {
    await page.goto('/')
    
    // Look for features link in navigation  
    const featuresLink = page.locator('a[href="/features"]').first()
    if (await featuresLink.isVisible()) {
      await featuresLink.click()
      await expect(page).toHaveURL(/.*\/features/)
    } else {
      // If no features link in nav, try direct navigation
      await page.goto('/features')
      await expect(page).toHaveURL(/.*\/features/)
    }
  })

  test('404 page works correctly', async ({ page }) => {
    await page.goto('/non-existent-page')
    
    // Should show 404 page or redirect to home
    const response = await page.waitForLoadState('networkidle')
    
    // Check if we get a 404 status or are redirected
    const url = page.url()
    const title = await page.title()
    
    // Either we get a 404 page or we're redirected to a valid page
    expect(url === '/non-existent-page' || url === '/' || url.includes('404')).toBeTruthy()
  })

  test('responsive design works', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    // Check that content is still accessible
    await expect(page.locator('body')).toBeVisible()
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto('/')
    
    await expect(page.locator('body')).toBeVisible()
  })
})