import { test, expect } from '@playwright/test'

test.describe('Custom Reports Builder', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'test-password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should navigate to reports page', async ({ page }) => {
    await page.goto('/reports')
    await expect(page).toHaveTitle(/Reports/)
    await expect(page.locator('h1')).toContainText('Reports')
    await expect(page.locator('text=Create custom reports')).toBeVisible()
  })

  test('should show report templates', async ({ page }) => {
    await page.goto('/reports')
    await page.click('button[role="tab"]:has-text("Templates")')
    
    // Should show system templates
    await expect(page.locator('text=Inventory Summary Report')).toBeVisible()
    await expect(page.locator('text=Order Accuracy Report')).toBeVisible()
    await expect(page.locator('text=Sync Performance Report')).toBeVisible()
  })

  test('should create new report from template', async ({ page }) => {
    await page.goto('/reports')
    await page.click('button[role="tab"]:has-text("Templates")')
    
    // Click on inventory template
    await page.click('text=Inventory Summary Report')
    await page.click('button:has-text("Use Template")')
    
    // Should redirect to builder
    await expect(page).toHaveURL(/\/reports\/builder\?template=/)
    await expect(page.locator('input[placeholder="Report Name"]')).toHaveValue('Inventory Summary Report')
  })

  test('should create new blank report', async ({ page }) => {
    await page.goto('/reports')
    await page.click('a:has-text("Create Report")')
    
    await expect(page).toHaveURL('/reports/builder')
    await expect(page.locator('input[placeholder="Report Name"]')).toHaveValue('Untitled Report')
  })

  test.describe('Report Builder', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/reports/builder')
    })

    test('should show all builder sections', async ({ page }) => {
      // Component library
      await expect(page.locator('h3:has-text("Components")')).toBeVisible()
      await expect(page.locator('text=Visualizations')).toBeVisible()
      await expect(page.locator('text=Bar Chart')).toBeVisible()
      await expect(page.locator('text=Line Chart')).toBeVisible()
      await expect(page.locator('text=Data Table')).toBeVisible()
      await expect(page.locator('text=Metric Card')).toBeVisible()

      // Tabs
      await expect(page.locator('button[role="tab"]:has-text("Design")')).toBeVisible()
      await expect(page.locator('button[role="tab"]:has-text("Data Sources")')).toBeVisible()
      await expect(page.locator('button[role="tab"]:has-text("Settings")')).toBeVisible()
    })

    test('should drag and drop components', async ({ page }) => {
      // Drag a metric card to canvas
      const metricCard = page.locator('text=Metric Card').first()
      const canvas = page.locator('text=Start building your report').locator('..')
      
      await metricCard.dragTo(canvas)
      
      // Component should appear on canvas
      await expect(page.locator('.col-span-4')).toBeVisible()
      await expect(page.locator('text=Metric Card').nth(1)).toBeVisible()
    })

    test('should configure component properties', async ({ page }) => {
      // Add a component first
      const metricCard = page.locator('text=Metric Card').first()
      const canvas = page.locator('text=Start building your report').locator('..')
      await metricCard.dragTo(canvas)
      
      // Click on the component
      await page.click('.col-span-4')
      
      // Properties panel should open
      await expect(page.locator('h3:has-text("Metric Card")')).toBeVisible()
      await expect(page.locator('label:has-text("Title")')).toBeVisible()
      
      // Update title
      await page.fill('input[id="title"]', 'Total Revenue')
      await expect(page.locator('input[id="title"]')).toHaveValue('Total Revenue')
    })

    test('should add data sources', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Data Sources")')
      await page.click('button:has-text("Add Data Source")')
      
      // Fill data source details
      await page.fill('input[placeholder="unique-id"]', 'revenue-data')
      await page.fill('textarea[placeholder*="SELECT"]', 'SELECT SUM(amount) as total FROM orders WHERE organization_id = :orgId')
      
      await expect(page.locator('text=revenue-data')).toBeVisible()
    })

    test('should configure report settings', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Settings")')
      
      // Update report name
      await page.fill('input[id="name"]', 'Monthly Revenue Report')
      
      // Change theme
      await page.click('button[id="theme"]')
      await page.click('text=Dark')
      
      // Change spacing
      await page.click('button[id="spacing"]')
      await page.click('text=Compact')
    })

    test('should preview report', async ({ page }) => {
      // Add a text component
      const textBlock = page.locator('text=Text Block').first()
      const canvas = page.locator('div[id="canvas"]')
      await textBlock.dragTo(canvas)
      
      // Switch to preview mode
      await page.click('button:has-text("Preview")')
      
      // Should show preview
      await expect(page.locator('button:has-text("Edit")')).toBeVisible()
      await expect(page.locator('.prose')).toBeVisible()
    })

    test('should save report', async ({ page }) => {
      // Update report name
      await page.fill('input[placeholder="Report Name"]', 'Test Revenue Report')
      
      // Save report
      await page.click('button:has-text("Save Report")')
      
      // Should redirect to report detail page
      await expect(page).toHaveURL(/\/reports\/[a-f0-9-]+/)
      await expect(page.locator('h1:has-text("Test Revenue Report")')).toBeVisible()
    })
  })

  test.describe('Report Management', () => {
    test('should list user reports', async ({ page }) => {
      await page.goto('/reports')
      
      // Should show reports table
      await expect(page.locator('table')).toBeVisible()
      await expect(page.locator('th:has-text("Name")')).toBeVisible()
      await expect(page.locator('th:has-text("Last Run")')).toBeVisible()
      await expect(page.locator('th:has-text("Schedule")')).toBeVisible()
    })

    test('should schedule report', async ({ page }) => {
      // Assuming we have a report
      await page.goto('/reports')
      await page.click('button[aria-label="Report actions"]').first()
      await page.click('text=Schedule')
      
      // Fill schedule form
      await page.check('input[name="enabled"]')
      await page.fill('input[name="cron"]', '0 9 * * MON')
      await page.fill('input[name="recipients"]', 'admin@example.com, manager@example.com')
      await page.check('input[value="pdf"]')
      await page.check('input[value="excel"]')
      
      await page.click('button:has-text("Save Schedule")')
      
      // Should show scheduled badge
      await expect(page.locator('span:has-text("Scheduled")')).toBeVisible()
    })

    test('should export report', async ({ page }) => {
      await page.goto('/reports')
      await page.click('button[aria-label="Report actions"]').first()
      
      // Export options
      await expect(page.locator('text=Export as PDF')).toBeVisible()
      await expect(page.locator('text=Export as Excel')).toBeVisible()
      await expect(page.locator('text=Export as CSV')).toBeVisible()
      
      // Click PDF export
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('text=Export as PDF')
      ])
      
      expect(download.suggestedFilename()).toMatch(/\.pdf$/)
    })

    test('should share report', async ({ page }) => {
      await page.goto('/reports')
      await page.click('button[aria-label="Report actions"]').first()
      await page.click('text=Share')
      
      // Share dialog
      await expect(page.locator('h2:has-text("Share Report")')).toBeVisible()
      await page.check('input[name="enabled"]')
      await page.fill('input[name="expiresIn"]', '168') // 7 days
      
      await page.click('button:has-text("Generate Link")')
      
      // Should show share link
      await expect(page.locator('input[readonly]')).toBeVisible()
      await expect(page.locator('button:has-text("Copy Link")')).toBeVisible()
    })

    test('should delete report', async ({ page }) => {
      await page.goto('/reports')
      const reportCount = await page.locator('table tbody tr').count()
      
      await page.click('button[aria-label="Report actions"]').first()
      await page.click('text=Delete')
      
      // Confirm dialog
      await page.click('button:has-text("Delete Report")')
      
      // Should have one less report
      await expect(page.locator('table tbody tr')).toHaveCount(reportCount - 1)
    })
  })

  test.describe('Report Viewing', () => {
    test('should view report details', async ({ page }) => {
      await page.goto('/reports')
      await page.click('table tbody tr').first()
      
      // Report detail page
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('button:has-text("Run Report")')).toBeVisible()
      await expect(page.locator('button:has-text("Edit")')).toBeVisible()
      await expect(page.locator('button:has-text("Schedule")')).toBeVisible()
    })

    test('should run report manually', async ({ page }) => {
      await page.goto('/reports/[id]') // Replace with actual ID
      await page.click('button:has-text("Run Report")')
      
      // Should show loading state
      await expect(page.locator('text=Generating report...')).toBeVisible()
      
      // Should show results
      await expect(page.locator('.report-preview')).toBeVisible()
    })

    test('should view report history', async ({ page }) => {
      await page.goto('/reports/[id]') // Replace with actual ID
      await page.click('button[role="tab"]:has-text("History")')
      
      // Should show run history
      await expect(page.locator('table')).toBeVisible()
      await expect(page.locator('th:has-text("Run Date")')).toBeVisible()
      await expect(page.locator('th:has-text("Status")')).toBeVisible()
      await expect(page.locator('th:has-text("Duration")')).toBeVisible()
    })
  })
})