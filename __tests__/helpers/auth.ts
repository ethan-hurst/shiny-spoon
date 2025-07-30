import { Page } from '@playwright/test'

export async function loginUser(page: Page, email: string) {
  // Mock implementation for testing
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', 'testpassword')
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

export async function logoutUser(page: Page) {
  await page.goto('/logout')
  await page.waitForURL('/')
}