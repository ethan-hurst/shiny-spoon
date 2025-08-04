import { test, expect } from '@playwright/test'

test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('shows sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
  })

  test('hides sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const sidebar = page.locator('aside')
    await expect(sidebar).not.toBeVisible()

    // But shows hamburger menu
    const hamburger = page.locator('[aria-label="Open mobile menu"]')
    await expect(hamburger).toBeVisible()
  })

  test('highlights active route', async ({ page }) => {
    await page.goto('/products')
    const activeItem = page.locator('a[href="/products"]')
    await expect(activeItem).toHaveClass(/bg-secondary/)
  })

  test('shows user menu with user information', async ({ page }) => {
    const userMenuButton = page.locator('[aria-label="Open user menu"]')
    await userMenuButton.click()

    await expect(page.locator('text=test@example.com')).toBeVisible()
  })

  test('allows user to sign out', async ({ page }) => {
    const userMenuButton = page.locator('[aria-label="Open user menu"]')
    await userMenuButton.click()

    const signOutButton = page.locator('text=Sign out')
    await signOutButton.click()

    // Should redirect to home page after sign out
    await page.waitForURL('/')
  })

  test('shows organization context in sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Organization name should be visible in sidebar
    await expect(page.locator('text=Test Organization')).toBeVisible()
  })

  test('collapses sidebar when toggle button is clicked', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    
    const toggleButton = page.locator('[aria-label="Collapse sidebar"]')
    await toggleButton.click()

    // Sidebar should be collapsed (narrower)
    const sidebar = page.locator('aside')
    await expect(sidebar).toHaveClass(/w-16/)
  })

  test('opens mobile menu when hamburger is clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    const hamburger = page.locator('[aria-label="Open mobile menu"]')
    await hamburger.click()

    // Mobile menu should be visible
    const mobileMenu = page.locator('[role="dialog"]')
    await expect(mobileMenu).toBeVisible()
  })

  test('navigates to different pages from sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Click on Products link
    await page.click('a[href="/products"]')
    await page.waitForURL('/products')
    
    // Click on Inventory link
    await page.click('a[href="/inventory"]')
    await page.waitForURL('/inventory')
  })

  test('shows welcome message with user name', async ({ page }) => {
    await expect(page.locator('text=Welcome back')).toBeVisible()
  })

  test('displays quick stats cards', async ({ page }) => {
    await expect(page.locator('text=Total Products')).toBeVisible()
    await expect(page.locator('text=Active Customers')).toBeVisible()
    await expect(page.locator('text=Monthly Revenue')).toBeVisible()
    await expect(page.locator('text=Sync Accuracy')).toBeVisible()
  })

  test('shows quick action cards', async ({ page }) => {
    await expect(page.locator('text=Manage Inventory')).toBeVisible()
    await expect(page.locator('text=Configure Pricing')).toBeVisible()
    await expect(page.locator('text=Set Up Integrations')).toBeVisible()
  })

  test('displays recent activity', async ({ page }) => {
    await expect(page.locator('text=Recent Activity')).toBeVisible()
    await expect(page.locator('text=Inventory sync completed successfully')).toBeVisible()
  })

  test('shows system status', async ({ page }) => {
    await expect(page.locator('text=System Status')).toBeVisible()
    await expect(page.locator('text=Data Sync')).toBeVisible()
    await expect(page.locator('text=API Health')).toBeVisible()
    await expect(page.locator('text=Database')).toBeVisible()
  })

  test('handles responsive navigation correctly', async ({ page }) => {
    // Start with desktop view
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.locator('aside')).toBeVisible()
    await expect(page.locator('[aria-label="Open mobile menu"]')).not.toBeVisible()

    // Switch to mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('aside')).not.toBeVisible()
    await expect(page.locator('[aria-label="Open mobile menu"]')).toBeVisible()
  })

  test('maintains navigation state across page refreshes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Collapse sidebar
    const toggleButton = page.locator('[aria-label="Collapse sidebar"]')
    await toggleButton.click()
    
    // Refresh page
    await page.reload()
    
    // Sidebar should still be collapsed
    const sidebar = page.locator('aside')
    await expect(sidebar).toHaveClass(/w-16/)
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    // Sign out first
    const userMenuButton = page.locator('[aria-label="Open user menu"]')
    await userMenuButton.click()
    const signOutButton = page.locator('text=Sign out')
    await signOutButton.click()
    
    // Try to access dashboard
    await page.goto('/')
    
    // Should be redirected to login
    await page.waitForURL('/login')
  })
}) 