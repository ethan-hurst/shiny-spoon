import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start each test from the home page
    await page.goto('/')
  })

  test('login page is accessible', async ({ page }) => {
    // Look for login link or button
    const loginLink = page.locator('a[href*="/login"], a[href*="/auth/login"], button:has-text("Login"), button:has-text("Sign In")').first()
    
    if (await loginLink.isVisible()) {
      await loginLink.click()
      // Should navigate to login page
      await expect(page).toHaveURL(/.*\/(login|auth)/)
    } else {
      // Try direct navigation
      await page.goto('/login')
      await expect(page).toHaveURL(/.*\/login/)
    }
  })

  test('signup page is accessible', async ({ page }) => {
    // Look for signup link or button
    const signupLink = page.locator('a[href*="/signup"], a[href*="/auth/signup"], button:has-text("Sign Up"), button:has-text("Register")').first()
    
    if (await signupLink.isVisible()) {
      await signupLink.click()
      // Should navigate to signup page
      await expect(page).toHaveURL(/.*\/(signup|register|auth)/)
    } else {
      // Try direct navigation
      await page.goto('/auth/signup')
      await expect(page).toHaveURL(/.*\/(signup|register|auth)/)
    }
  })

  test('login form validation', async ({ page }) => {
    await page.goto('/login')
    
    // Look for email and password fields
    const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first()
    const passwordField = page.locator('input[type="password"], input[name="password"]').first()
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first()
    
    if (await emailField.isVisible() && await passwordField.isVisible() && await submitButton.isVisible()) {
      // Try submitting empty form
      await submitButton.click()
      
      // Should show validation errors or remain on login page
      const url = page.url()
      expect(url).toMatch(/\/(login|auth)/)
      
      // Fill in invalid email
      await emailField.fill('invalid-email')
      await passwordField.fill('short')
      await submitButton.click()
      
      // Should still be on login page due to validation
      expect(page.url()).toMatch(/\/(login|auth)/)
    }
  })

  test('protected routes redirect to login', async ({ page }) => {
    // Try to access dashboard or admin routes without authentication
    const protectedRoutes = ['/dashboard', '/admin', '/portal', '/profile']
    
    for (const route of protectedRoutes) {
      await page.goto(route)
      
      // Should redirect to login or show unauthorized message
      const url = page.url()
      const hasLoginRedirect = url.includes('/login') || url.includes('/auth')
      const hasUnauthorized = await page.locator('text=/unauthorized|access denied|please login/i').isVisible()
      const staysOnHome = url === '/' || url.endsWith('/')
      
      expect(hasLoginRedirect || hasUnauthorized || staysOnHome).toBeTruthy()
    }
  })

  test('logout functionality', async ({ page }) => {
    await page.goto('/')
    
    // Look for logout button (might only be visible when logged in)
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a[href*="/logout"]').first()
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click()
      
      // Should redirect to home or login page
      const url = page.url()
      expect(url === '/' || url.includes('/login') || url.includes('/auth')).toBeTruthy()
    }
  })
})