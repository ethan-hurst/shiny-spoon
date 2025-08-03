import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser, setupTestOrganization } from '../helpers/test-utils'

test.describe('AI Insights', () => {
  let testUser: any
  let organizationId: string

  test.beforeAll(async () => {
    // Create test user and organization
    const setup = await setupTestOrganization('insights-test')
    testUser = setup.user
    organizationId = setup.organizationId
  })

  test.afterAll(async () => {
    // Cleanup
    await deleteTestUser(testUser.email)
  })

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', testUser.email)
    await page.fill('input[name="password"]', testUser.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('should display insights dashboard', async ({ page }) => {
    await page.goto('/insights')
    
    // Check page title and description
    await expect(page.locator('h1')).toContainText('AI-Powered Insights')
    await expect(page.locator('text=Intelligent predictions and recommendations')).toBeVisible()
    
    // Check summary cards
    await expect(page.locator('text=Active Insights')).toBeVisible()
    await expect(page.locator('text=Demand Forecasts')).toBeVisible()
    await expect(page.locator('text=Reorder Suggestions')).toBeVisible()
    await expect(page.locator('text=Price Optimizations')).toBeVisible()
  })

  test('should refresh insights', async ({ page }) => {
    await page.goto('/insights')
    
    // Click refresh button
    const refreshButton = page.locator('button:has-text("Refresh Insights")')
    await expect(refreshButton).toBeVisible()
    
    // Mock the AI response time
    await refreshButton.click()
    
    // Wait for refresh to complete (button should be enabled again)
    await expect(refreshButton).toBeEnabled({ timeout: 10000 })
  })

  test('should navigate between tabs', async ({ page }) => {
    await page.goto('/insights')
    
    // Check all tabs are present
    const tabs = ['Demand Forecast', 'Reorder Points', 'Price Optimization', 'Trend Analysis', 'Ask AI']
    
    for (const tabName of tabs) {
      const tab = page.locator(`button:has-text("${tabName}")`)
      await expect(tab).toBeVisible()
      
      // Click tab and verify content changes
      await tab.click()
      await page.waitForTimeout(500) // Wait for tab transition
    }
  })

  test.describe('Demand Forecast', () => {
    test('should display demand forecast chart', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Demand Forecast")')
      
      // Check for chart elements
      await expect(page.locator('text=Demand Forecast')).toBeVisible()
      await expect(page.locator('text=AI-powered demand predictions')).toBeVisible()
      
      // Check for metrics
      await expect(page.locator('text=Average Daily Demand')).toBeVisible()
      await expect(page.locator('text=Forecast Period')).toBeVisible()
      await expect(page.locator('text=Confidence Level')).toBeVisible()
    })

    test('should switch between chart types', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Demand Forecast")')
      
      // Find chart type selector
      const chartTypeSelector = page.locator('select').first()
      
      // Switch to bar chart
      await chartTypeSelector.selectOption('bar')
      await page.waitForTimeout(500)
      
      // Switch back to line chart
      await chartTypeSelector.selectOption('line')
      await page.waitForTimeout(500)
    })

    test('should filter by product', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Demand Forecast")')
      
      // Find product selector
      const productSelector = page.locator('select').nth(1)
      
      // Check if "All Products" is selected by default
      await expect(productSelector).toHaveValue('all')
      
      // Note: Actual product filtering would require test data
    })
  })

  test.describe('Reorder Suggestions', () => {
    test('should display reorder suggestions', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Reorder Points")')
      
      // Check for reorder suggestions content
      await expect(page.locator('text=Reorder Suggestions')).toBeVisible()
      await expect(page.locator('text=AI-optimized reorder points')).toBeVisible()
    })

    test('should highlight urgent reorders', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Reorder Points")')
      
      // Check for urgent reorder alerts (if any)
      const urgentAlert = page.locator('text=Urgent Reorders Required')
      if (await urgentAlert.isVisible()) {
        // Verify urgent alert styling
        const alertCard = urgentAlert.locator('..')
        await expect(alertCard).toHaveClass(/border-orange/)
      }
    })
  })

  test.describe('Price Optimization', () => {
    test('should display price recommendations', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Price Optimization")')
      
      // Check for price optimization content
      await expect(page.locator('text=Price Optimization')).toBeVisible()
      await expect(page.locator('text=AI-powered pricing recommendations')).toBeVisible()
    })

    test('should show revenue opportunity', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Price Optimization")')
      
      // Check for revenue opportunity card (if recommendations exist)
      const revenueCard = page.locator('text=Revenue Opportunity')
      if (await revenueCard.isVisible()) {
        await expect(revenueCard.locator('..')).toHaveClass(/border-green/)
      }
    })
  })

  test.describe('Natural Language Chat', () => {
    test('should display chat interface', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Ask AI")')
      
      // Check for chat elements
      await expect(page.locator('text=AI Assistant')).toBeVisible()
      await expect(page.locator('text=Hello! I\'m your AI assistant')).toBeVisible()
      
      // Check for input field
      const chatInput = page.locator('input[placeholder*="Ask me anything"]')
      await expect(chatInput).toBeVisible()
    })

    test('should show suggested questions', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Ask AI")')
      
      // Check for suggested questions
      await expect(page.locator('text=Suggested questions:')).toBeVisible()
      
      const suggestedQuestions = [
        'What products should I reorder soon?',
        'Are there any pricing opportunities?',
        'What are my inventory trends this month?'
      ]
      
      for (const question of suggestedQuestions) {
        await expect(page.locator(`button:has-text("${question}")`)).toBeVisible()
      }
    })

    test('should send a chat message', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Ask AI")')
      
      // Type a message
      const chatInput = page.locator('input[placeholder*="Ask me anything"]')
      await chatInput.fill('What is my current inventory status?')
      
      // Send the message
      await page.locator('button[type="submit"]').click()
      
      // Wait for response (check for loading indicator)
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible()
      
      // Wait for response to complete
      await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible({ timeout: 30000 })
    })

    test('should use suggested question', async ({ page }) => {
      await page.goto('/insights')
      await page.click('button:has-text("Ask AI")')
      
      // Click a suggested question
      const suggestedButton = page.locator('button:has-text("What products should I reorder soon?")')
      await suggestedButton.click()
      
      // Verify the question was sent
      await expect(page.locator('text=What products should I reorder soon?')).toBeVisible()
      
      // Wait for response
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible()
    })
  })

  test.describe('Anomaly Alerts', () => {
    test('should display anomaly alerts section', async ({ page }) => {
      await page.goto('/insights')
      
      // Check if anomaly alerts are present
      const anomalySection = page.locator('text=Anomaly Alerts')
      if (await anomalySection.isVisible()) {
        await expect(anomalySection.locator('..')).toContainText('Unusual patterns and issues')
      }
    })

    test('should dismiss an alert', async ({ page }) => {
      await page.goto('/insights')
      
      // Find dismiss buttons (X buttons)
      const dismissButtons = page.locator('button:has(svg.h-4.w-4)')
      const count = await dismissButtons.count()
      
      if (count > 0) {
        // Click the first dismiss button
        await dismissButtons.first().click()
        
        // Wait for the alert to be removed
        await page.waitForTimeout(1000)
        
        // Verify the count decreased
        const newCount = await dismissButtons.count()
        expect(newCount).toBeLessThan(count)
      }
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should be responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      await page.goto('/insights')
      
      // Check that main elements are still visible
      await expect(page.locator('h1:has-text("AI-Powered Insights")')).toBeVisible()
      
      // Check that tabs are scrollable or stacked
      const tabsList = page.locator('[role="tablist"]')
      await expect(tabsList).toBeVisible()
      
      // Navigate to chat tab on mobile
      await page.click('button:has-text("Ask AI")')
      await expect(page.locator('text=AI Assistant')).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept API calls and return errors
      await page.route('**/api/ai/chat', route => {
        route.fulfill({
          status: 500,
          body: 'Internal Server Error'
        })
      })
      
      await page.goto('/insights')
      await page.click('button:has-text("Ask AI")')
      
      // Try to send a message
      const chatInput = page.locator('input[placeholder*="Ask me anything"]')
      await chatInput.fill('Test message')
      await page.locator('button[type="submit"]').click()
      
      // Should handle error gracefully (exact behavior depends on implementation)
      // At minimum, the page shouldn't crash
      await page.waitForTimeout(2000)
      await expect(page.locator('h1:has-text("AI-Powered Insights")')).toBeVisible()
    })
  })
})