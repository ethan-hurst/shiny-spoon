import { test, expect } from '@playwright/test'

// Test the load testing dashboard
test.describe('Load Testing Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the k6 dashboard
    await page.goto('/k6/dashboard/index.html')
  })

  test('should display loading state initially', async ({ page }) => {
    const loading = page.locator('#loading')
    await expect(loading).toBeVisible()
    await expect(loading).toContainText('Loading performance data...')
  })

  test('should load and display dashboard data', async ({ page }) => {
    // Wait for dashboard to load
    await page.waitForSelector('#dashboard', { state: 'visible' })
    
    // Check that loading is hidden
    const loading = page.locator('#loading')
    await expect(loading).not.toBeVisible()
    
    // Verify key metrics are displayed
    const avgResponseTime = page.locator('#avgResponseTime')
    await expect(avgResponseTime).not.toContainText('-')
    await expect(avgResponseTime).toContainText('ms')
    
    const errorRate = page.locator('#errorRate')
    await expect(errorRate).toContainText('%')
    
    const throughput = page.locator('#throughput')
    await expect(throughput).not.toContainText('-')
    
    const successRate = page.locator('#successRate')
    await expect(successRate).toContainText('%')
  })

  test('should show metric changes from previous test', async ({ page }) => {
    await page.waitForSelector('#dashboard', { state: 'visible' })
    
    // Check response time change indicator
    const responseTimeChange = page.locator('#avgResponseTimeChange')
    await expect(responseTimeChange).toContainText('from last test')
    
    // Verify color coding (positive/negative)
    const hasClass = await responseTimeChange.evaluate(el => 
      el.classList.contains('positive') || el.classList.contains('negative')
    )
    expect(hasClass).toBe(true)
  })

  test('should display response time chart', async ({ page }) => {
    await page.waitForSelector('#dashboard', { state: 'visible' })
    
    // Check chart canvas is rendered
    const chartCanvas = page.locator('#responseTimeChart')
    await expect(chartCanvas).toBeVisible()
    
    // Verify chart has been initialized (canvas has content)
    const hasContent = await chartCanvas.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)
      return imageData?.data.some(pixel => pixel !== 0) ?? false
    })
    expect(hasContent).toBe(true)
  })

  test('should display error rate chart', async ({ page }) => {
    await page.waitForSelector('#dashboard', { state: 'visible' })
    
    const chartCanvas = page.locator('#errorRateChart')
    await expect(chartCanvas).toBeVisible()
  })

  test('should display test history table', async ({ page }) => {
    await page.waitForSelector('#dashboard', { state: 'visible' })
    
    // Check table headers
    const table = page.locator('.test-table')
    await expect(table).toBeVisible()
    
    const headers = ['Date', 'Test Type', 'P95 Response', 'Error Rate', 'Throughput', 'Status']
    for (const header of headers) {
      await expect(table.locator('th', { hasText: header })).toBeVisible()
    }
    
    // Check table has rows
    const rows = table.locator('tbody tr')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)
    
    // Verify first row has data
    const firstRow = rows.first()
    await expect(firstRow.locator('td').first()).not.toBeEmpty()
  })

  test('should display status badges correctly', async ({ page }) => {
    await page.waitForSelector('#dashboard', { state: 'visible' })
    
    // Find status badges
    const passedBadges = page.locator('.status-passed')
    const failedBadges = page.locator('.status-failed')
    
    // At least one badge should exist
    const totalBadges = await passedBadges.count() + await failedBadges.count()
    expect(totalBadges).toBeGreaterThan(0)
    
    // Check badge styling
    if (await passedBadges.count() > 0) {
      const passedBadge = passedBadges.first()
      await expect(passedBadge).toContainText('PASSED')
      const bgColor = await passedBadge.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      )
      expect(bgColor).toContain('rgb') // Has background color
    }
  })

  test('should handle missing dashboard data gracefully', async ({ page }) => {
    // Intercept and return 404
    await page.route('**/dashboard-data.json', route => 
      route.fulfill({ status: 404 })
    )
    
    await page.reload()
    
    // Should show error message
    const error = page.locator('#error')
    await expect(error).toBeVisible()
    await expect(error).toContainText('Error loading dashboard')
  })

  test('should format dates correctly', async ({ page }) => {
    await page.waitForSelector('#dashboard', { state: 'visible' })
    
    // Check date in test history
    const firstDateCell = page.locator('.test-table tbody tr').first().locator('td').first()
    const dateText = await firstDateCell.textContent()
    
    // Should be a valid date format
    expect(dateText).toBeTruthy()
    const date = new Date(dateText!)
    expect(date.toString()).not.toBe('Invalid Date')
  })

  test('should have responsive design', async ({ page }) => {
    await page.waitForSelector('#dashboard', { state: 'visible' })
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Metrics grid should stack vertically
    const metricsGrid = page.locator('.metrics-grid')
    const gridStyle = await metricsGrid.evaluate(el => 
      window.getComputedStyle(el).gridTemplateColumns
    )
    expect(gridStyle).toContain('minmax')
    
    // Charts should still be visible
    await expect(page.locator('#responseTimeChart')).toBeVisible()
  })
})

// Test GitHub Actions workflow
test.describe('Load Test CI/CD', () => {
  test('smoke test should run on pull requests', async ({ page }) => {
    // This would normally be tested in the CI environment
    // Here we just verify the workflow file exists
    const response = await page.request.get('/.github/workflows/load-tests.yml')
    expect(response.ok()).toBe(true)
    
    const content = await response.text()
    expect(content).toContain('pull_request')
    expect(content).toContain('smoke-test')
  })

  test('should have performance regression check', async ({ page }) => {
    // Verify regression check script exists
    const response = await page.request.get('/scripts/check-performance-regression.js')
    expect(response.ok()).toBe(true)
    
    const content = await response.text()
    expect(content).toContain('regressions')
    expect(content).toContain('baseline')
  })
})

// Test k6 test configurations
test.describe('K6 Test Configurations', () => {
  test('should have base configuration', async ({ page }) => {
    const response = await page.request.get('/k6/config/base.js')
    expect(response.ok()).toBe(true)
    
    const content = await response.text()
    expect(content).toContain('baseConfig')
    expect(content).toContain('thresholds')
    expect(content).toContain('stages')
  })

  test('should have tier-specific limits', async ({ page }) => {
    const response = await page.request.get('/k6/config/tiers.js')
    expect(response.ok()).toBe(true)
    
    const content = await response.text()
    expect(content).toContain('tierLimits')
    expect(content).toContain('free')
    expect(content).toContain('enterprise')
  })

  test('should have all test types', async ({ page }) => {
    const testTypes = ['smoke', 'load', 'stress', 'spike', 'soak', 'breaking-point', 'flash-sale']
    
    for (const testType of testTypes) {
      const response = await page.request.get(`/k6/tests/${testType}-test.js`)
      expect(response.ok()).toBe(true)
      
      const content = await response.text()
      expect(content).toContain('export const options')
      expect(content).toContain('export default function')
    }
  })

  test('should have test scenarios library', async ({ page }) => {
    const response = await page.request.get('/k6/lib/scenarios.js')
    expect(response.ok()).toBe(true)
    
    const content = await response.text()
    expect(content).toContain('browseProducts')
    expect(content).toContain('searchProducts')
    expect(content).toContain('createOrder')
    expect(content).toContain('generateReport')
  })
})

// Test performance baselines
test.describe('Performance Baselines', () => {
  test('should have baseline metrics defined', async ({ page }) => {
    const response = await page.request.get('/k6/benchmarks/baseline.json')
    expect(response.ok()).toBe(true)
    
    const baseline = await response.json()
    
    // Verify structure
    expect(baseline).toHaveProperty('version')
    expect(baseline).toHaveProperty('endpoints')
    expect(baseline).toHaveProperty('database')
    expect(baseline).toHaveProperty('cache')
    expect(baseline).toHaveProperty('resources')
    expect(baseline).toHaveProperty('thresholds')
    
    // Check endpoint metrics
    expect(baseline.endpoints['/api/products']).toHaveProperty('p50')
    expect(baseline.endpoints['/api/products']).toHaveProperty('p95')
    expect(baseline.endpoints['/api/products']).toHaveProperty('p99')
    expect(baseline.endpoints['/api/products']).toHaveProperty('error_rate')
    
    // Verify reasonable values
    expect(baseline.endpoints['/api/products'].p95).toBeLessThan(1000)
    expect(baseline.endpoints['/api/products'].error_rate).toBeLessThan(0.01)
  })
})