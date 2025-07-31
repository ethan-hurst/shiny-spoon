import { test, expect, type Page } from '@playwright/test'

// Mock data for testing
const mockAuditLogs = [
  {
    id: 'log-1',
    created_at: '2024-01-15T10:00:00Z',
    user_email: 'admin@example.com',
    user_name: 'Admin User',
    user_role: 'admin',
    action: 'create',
    entity_type: 'product',
    entity_name: 'Test Product',
    ip_address: '192.168.1.1',
    old_values: null,
    new_values: { name: 'Test Product', price: 100 },
  },
  {
    id: 'log-2',
    created_at: '2024-01-16T11:00:00Z',
    user_email: 'user@example.com',
    user_name: 'Regular User',
    user_role: 'member',
    action: 'update',
    entity_type: 'product',
    entity_name: 'Test Product',
    ip_address: '192.168.1.2',
    old_values: { name: 'Test Product', price: 100 },
    new_values: { name: 'Test Product', price: 150 },
  },
  {
    id: 'log-3',
    created_at: '2024-01-17T12:00:00Z',
    user_email: 'admin@example.com',
    user_name: 'Admin User',
    user_role: 'admin',
    action: 'delete',
    entity_type: 'customer',
    entity_name: 'Test Customer',
    ip_address: '192.168.1.1',
    old_values: { name: 'Test Customer', email: 'test@example.com' },
    new_values: null,
  },
]

const mockUsers = [
  { user_id: 'user-1', full_name: 'Admin User', email: 'admin@example.com' },
  { user_id: 'user-2', full_name: 'Regular User', email: 'user@example.com' },
]

test.describe('Audit Trail', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/auth/user', async (route) => {
      await route.fulfill({
        json: {
          user: {
            id: 'user-1',
            email: 'admin@example.com',
            user_metadata: { full_name: 'Admin User' },
          },
        },
      })
    })

    await page.route('**/rest/v1/user_profiles**', async (route) => {
      await route.fulfill({
        json: {
          data: {
            organization_id: 'org-123',
            role: 'admin',
            full_name: 'Admin User',
          },
        },
      })
    })

    await page.route('**/rest/v1/audit_logs_with_details**', async (route) => {
      const url = new URL(route.request().url())
      const searchParams = url.searchParams
      
      // Apply filters based on query parameters
      let filteredLogs = [...mockAuditLogs]
      
      if (searchParams.get('action')) {
        const action = searchParams.get('action')
        filteredLogs = filteredLogs.filter(log => log.action === action)
      }
      
      if (searchParams.get('entity_type')) {
        const entityType = searchParams.get('entity_type')
        filteredLogs = filteredLogs.filter(log => log.entity_type === entityType)
      }

      await route.fulfill({
        json: filteredLogs,
        headers: { 'Content-Range': `0-${filteredLogs.length - 1}/${filteredLogs.length}` },
      })
    })

    await page.route('**/rest/v1/user_profiles?select=user_id,full_name,email**', async (route) => {
      await route.fulfill({
        json: mockUsers,
      })
    })

    // Navigate to audit trail page
    await page.goto('/audit')
  })

  test('should display audit trail page with correct title and description', async ({ page }) => {
    // Check page title and description
    await expect(page.locator('h1')).toContainText('Audit Trail')
    await expect(page.locator('p')).toContainText('Complete activity log for compliance and security monitoring')
    
    // Check for Shield icon
    await expect(page.locator('h1 svg')).toBeVisible()
  })

  test('should display audit logs in table format', async ({ page }) => {
    // Wait for table to load
    await expect(page.locator('table')).toBeVisible()
    
    // Check table headers
    await expect(page.locator('th')).toContainText(['Time', 'User', 'Action', 'Entity', 'Details'])
    
    // Check that audit logs are displayed
    await expect(page.locator('tbody tr')).toHaveCount(3)
    
    // Check first row data
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow.locator('td').nth(1)).toContainText('Admin User')
    await expect(firstRow.locator('[data-testid="action-badge"]')).toContainText('create')
    await expect(firstRow.locator('td').nth(3)).toContainText('product')
  })

  test('should show user information with avatars and roles', async ({ page }) => {
    // Check that user avatars are displayed
    await expect(page.locator('tbody tr [data-testid="user-avatar"]')).toHaveCount(3)
    
    // Check user names and roles are displayed
    await expect(page.locator('tbody tr').first().locator('[data-testid="user-info"]')).toContainText('Admin User')
    await expect(page.locator('tbody tr').first().locator('[data-testid="user-role"]')).toContainText('admin')
    
    await expect(page.locator('tbody tr').nth(1).locator('[data-testid="user-info"]')).toContainText('Regular User')
    await expect(page.locator('tbody tr').nth(1).locator('[data-testid="user-role"]')).toContainText('member')
  })

  test('should display action badges with correct colors and icons', async ({ page }) => {
    // Check action badges
    const createBadge = page.locator('tbody tr').first().locator('[data-testid="action-badge"]')
    await expect(createBadge).toContainText('create')
    await expect(createBadge).toHaveClass(/bg-green-500/)
    
    const updateBadge = page.locator('tbody tr').nth(1).locator('[data-testid="action-badge"]')
    await expect(updateBadge).toContainText('update')
    await expect(updateBadge).toHaveClass(/bg-blue-500/)
    
    const deleteBadge = page.locator('tbody tr').nth(2).locator('[data-testid="action-badge"]')
    await expect(deleteBadge).toContainText('delete')
    await expect(deleteBadge).toHaveClass(/bg-red-500/)
  })

  test('should filter audit logs by date range', async ({ page }) => {
    // Click on date range picker
    await page.locator('[data-testid="date-range-picker"]').click()
    
    // Select date range (implementation depends on date picker component)
    // For now, we'll test the quick filter buttons
    await page.locator('button:has-text("Last 24 hours")').click()
    
    // Verify URL parameters are updated
    await expect(page).toHaveURL(/from=.*&to=.*/)
  })

  test('should filter audit logs by user', async ({ page }) => {
    // Open user filter dropdown
    await page.locator('[data-testid="user-filter"]').click()
    
    // Select a user
    await page.locator('[data-testid="user-option"]:has-text("Admin User")').click()
    
    // Verify URL is updated
    await expect(page).toHaveURL(/user=/)
    
    // Check that only logs from selected user are shown
    // This would depend on the mock filtering logic
  })

  test('should filter audit logs by action type', async ({ page }) => {
    // Open action filter dropdown
    await page.locator('[data-testid="action-filter"]').click()
    
    // Select create action
    await page.locator('[data-testid="action-option"]:has-text("Create")').click()
    
    // Verify URL is updated
    await expect(page).toHaveURL(/action=create/)
    
    // Verify only create actions are shown (would need mock filtering)
  })

  test('should filter audit logs by entity type', async ({ page }) => {
    // Open entity type filter dropdown
    await page.locator('[data-testid="entity-filter"]').click()
    
    // Select product entity type
    await page.locator('[data-testid="entity-option"]:has-text("Product")').click()
    
    // Verify URL is updated
    await expect(page).toHaveURL(/entity=product/)
  })

  test('should show and clear active filter count', async ({ page }) => {
    // Apply multiple filters
    await page.locator('[data-testid="action-filter"]').click()
    await page.locator('[data-testid="action-option"]:has-text("Create")').click()
    
    await page.locator('[data-testid="entity-filter"]').click()
    await page.locator('[data-testid="entity-option"]:has-text("Product")').click()
    
    // Check that clear filters button shows correct count
    const clearButton = page.locator('button:has-text("Clear filters")')
    await expect(clearButton).toBeVisible()
    await expect(clearButton.locator('.badge')).toContainText('2')
    
    // Click clear filters
    await clearButton.click()
    
    // Verify filters are cleared
    await expect(page).toHaveURL('/audit')
    await expect(clearButton).not.toBeVisible()
  })

  test('should use quick filter buttons', async ({ page }) => {
    // Test "Last 24 hours" quick filter
    await page.locator('button:has-text("Last 24 hours")').click()
    await expect(page).toHaveURL(/from=.*&to=.*/)
    
    // Test "Authentication events" quick filter
    await page.locator('button:has-text("Authentication events")').click()
    await expect(page).toHaveURL(/action=login,logout/)
    
    // Test "Data changes" quick filter
    await page.locator('button:has-text("Data changes")').click()
    await expect(page).toHaveURL(/action=create,update,delete/)
  })

  test('should show row action dropdown menu', async ({ page }) => {
    // Click on first row's action menu
    await page.locator('tbody tr').first().locator('[data-testid="row-actions"]').click()
    
    // Check dropdown menu items
    await expect(page.locator('[data-testid="view-details"]')).toBeVisible()
    await expect(page.locator('[data-testid="view-entity"]')).toBeVisible()
    await expect(page.locator('[data-testid="copy-details"]')).toBeVisible()
  })

  test('should navigate to audit log details', async ({ page }) => {
    // Click view details from dropdown
    await page.locator('tbody tr').first().locator('[data-testid="row-actions"]').click()
    await page.locator('[data-testid="view-details"]').click()
    
    // Should navigate to details page
    await expect(page).toHaveURL(/\/audit\/log-1/)
  })

  test('should copy audit log details to clipboard', async ({ page }) => {
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    
    // Click copy details from dropdown
    await page.locator('tbody tr').first().locator('[data-testid="row-actions"]').click()
    await page.locator('[data-testid="copy-details"]').click()
    
    // Verify clipboard content (this is browser-dependent)
    // In a real test, you might mock the clipboard API
  })

  test('should show export button for admin users', async ({ page }) => {
    // Check that export button is visible for admin
    await expect(page.locator('[data-testid="export-button"]')).toBeVisible()
  })

  test('should show retention policy button for admin users', async ({ page }) => {
    // Check that retention policy button is visible for admin
    await expect(page.locator('[data-testid="retention-policy-button"]')).toBeVisible()
  })

  test('should open export dropdown menu', async ({ page }) => {
    // Click export button
    await page.locator('[data-testid="export-button"]').click()
    
    // Check export options
    await expect(page.locator('[data-testid="export-csv"]')).toBeVisible()
    await expect(page.locator('[data-testid="export-json"]')).toBeVisible()
    await expect(page.locator('[data-testid="soc2-report"]')).toBeVisible()
    await expect(page.locator('[data-testid="iso27001-report"]')).toBeVisible()
    await expect(page.locator('[data-testid="custom-report"]')).toBeVisible()
  })

  test('should trigger CSV export', async ({ page }) => {
    // Mock the export API
    await page.route('**/api/actions/audit/export', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: 'timestamp,user_email,action\n2024-01-15,admin@example.com,create',
          filename: 'audit_logs_2024-01-15.csv',
        },
      })
    })

    // Mock download
    const downloadPromise = page.waitForEvent('download')
    
    // Click export button and select CSV
    await page.locator('[data-testid="export-button"]').click()
    await page.locator('[data-testid="export-csv"]').click()
    
    // Wait for download
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/audit_logs_.*\.csv/)
  })

  test('should open retention policy dialog', async ({ page }) => {
    // Click retention policy button
    await page.locator('[data-testid="retention-policy-button"]').click()
    
    // Check dialog is opened
    await expect(page.locator('[data-testid="retention-dialog"]')).toBeVisible()
    await expect(page.locator('h2:has-text("Audit Log Retention Policies")')).toBeVisible()
    
    // Check dialog content
    await expect(page.locator('[data-testid="retention-table"]')).toBeVisible()
    await expect(page.locator('[data-testid="add-policy-form"]')).toBeVisible()
  })

  test('should add new retention policy', async ({ page }) => {
    // Open retention dialog
    await page.locator('[data-testid="retention-policy-button"]').click()
    
    // Fill new policy form
    await page.locator('[data-testid="entity-type-select"]').click()
    await page.locator('[data-testid="entity-option"]:has-text("Products")').click()
    
    await page.locator('[data-testid="retention-days-input"]').fill('90')
    
    // Click add policy button
    await page.locator('[data-testid="add-policy-button"]').click()
    
    // Verify policy is added to table
    await expect(page.locator('[data-testid="retention-table"] tbody tr')).toHaveCount(2)
  })

  test('should navigate between pages', async ({ page }) => {
    // Mock multiple pages of data
    await page.route('**/rest/v1/audit_logs_with_details**', async (route) => {
      const url = new URL(route.request().url())
      const range = url.searchParams.get('Range') || '0-49'
      const [start, end] = range.split('-').map(Number)
      
      // Generate mock data for pagination
      const totalLogs = 150
      const pageSize = 50
      const currentPage = Math.floor(start / pageSize) + 1
      
      const logs = Array.from({ length: Math.min(pageSize, totalLogs - start) }, (_, i) => ({
        id: `log-${start + i + 1}`,
        created_at: new Date(Date.now() - (start + i) * 60000).toISOString(),
        user_email: 'user@example.com',
        user_name: 'Test User',
        action: 'view',
        entity_type: 'product',
        entity_name: `Product ${start + i + 1}`,
      }))

      await route.fulfill({
        json: logs,
        headers: { 'Content-Range': `${start}-${start + logs.length - 1}/${totalLogs}` },
      })
    })

    await page.reload()
    
    // Check pagination is visible
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible()
    
    // Click next page
    await page.locator('[data-testid="pagination-next"]').click()
    
    // Verify URL includes page parameter
    await expect(page).toHaveURL(/page=2/)
    
    // Click previous page
    await page.locator('[data-testid="pagination-previous"]').click()
    
    // Verify back to page 1
    await expect(page).toHaveURL(/page=1/)
  })

  test('should handle empty state', async ({ page }) => {
    // Mock empty response
    await page.route('**/rest/v1/audit_logs_with_details**', async (route) => {
      await route.fulfill({
        json: [],
        headers: { 'Content-Range': '0-0/0' },
      })
    })

    await page.reload()
    
    // Check empty state message
    await expect(page.locator('table tbody')).toContainText('No audit logs found.')
  })

  test('should handle loading state', async ({ page }) => {
    // Delay the API response to test loading state
    await page.route('**/rest/v1/audit_logs_with_details**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.fulfill({ json: mockAuditLogs })
    })

    await page.reload()
    
    // Check loading skeleton is visible
    await expect(page.locator('[data-testid="audit-skeleton"]')).toBeVisible()
    
    // Wait for loading to complete
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('[data-testid="audit-skeleton"]')).not.toBeVisible()
  })

  test('should restrict access for non-admin users', async ({ page }) => {
    // Mock non-admin user
    await page.route('**/rest/v1/user_profiles**', async (route) => {
      await route.fulfill({
        json: {
          data: {
            organization_id: 'org-123',
            role: 'member',
            full_name: 'Regular User',
          },
        },
      })
    })

    await page.reload()
    
    // Check that admin-only features are not visible
    await expect(page.locator('[data-testid="export-button"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="retention-policy-button"]')).not.toBeVisible()
  })
})