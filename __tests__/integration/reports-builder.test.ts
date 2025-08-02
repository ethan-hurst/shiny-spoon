import { createClient } from '@supabase/supabase-js'
import { SYSTEM_REPORT_TEMPLATES } from '@/lib/reports/report-templates'
import type { ReportConfig, Report, ReportTemplate } from '@/types/reports.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

describe('Reports Builder Integration Tests', () => {
  let supabase: ReturnType<typeof createClient>
  let testOrgId: string
  let testUserId: string
  let testReportId: string
  let testTemplateId: string

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Create test organization
    const { data: org } = await supabase
      .from('organizations')
      .insert({ name: 'Test Reports Org', slug: 'test-reports-org' })
      .select()
      .single()
    
    testOrgId = org.id

    // Create test user
    const { data: { user } } = await supabase.auth.signUp({
      email: 'reports-test@example.com',
      password: 'test-password-123'
    })
    
    testUserId = user!.id

    // Link user to organization
    await supabase
      .from('user_profiles')
      .insert({
        user_id: testUserId,
        organization_id: testOrgId,
        role: 'admin'
      })
  })

  afterAll(async () => {
    // Cleanup
    if (testReportId) {
      await supabase.from('reports').delete().eq('id', testReportId)
    }
    if (testTemplateId) {
      await supabase.from('report_templates').delete().eq('id', testTemplateId)
    }
    await supabase.from('user_profiles').delete().eq('user_id', testUserId)
    await supabase.auth.admin.deleteUser(testUserId)
    await supabase.from('organizations').delete().eq('id', testOrgId)
  })

  describe('Report Templates', () => {
    it('should create a custom report template', async () => {
      const templateConfig: ReportConfig = {
        name: 'Custom Inventory Report',
        layout: 'grid',
        components: [
          {
            id: 'metric-1',
            type: 'metric',
            config: {
              title: 'Total Value',
              dataSource: 'inventory',
              metric: 'value',
              aggregation: 'sum',
              format: 'currency'
            },
            position: { x: 0, y: 0 },
            size: { width: 4, height: 2 }
          }
        ],
        dataSources: [
          {
            id: 'inventory',
            type: 'query',
            query: 'SELECT * FROM inventory WHERE organization_id = :orgId'
          }
        ],
        filters: [],
        style: { theme: 'light', spacing: 'normal' }
      }

      const { data: template, error } = await supabase
        .from('report_templates')
        .insert({
          name: 'Custom Inventory Template',
          description: 'Test template',
          category: 'inventory',
          organization_id: testOrgId,
          config: templateConfig,
          created_by: testUserId
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(template).toBeDefined()
      expect(template.name).toBe('Custom Inventory Template')
      testTemplateId = template.id
    })

    it('should retrieve system templates', async () => {
      const { data: templates, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('is_system', true)
        .eq('is_public', true)

      expect(error).toBeNull()
      expect(templates).toBeDefined()
      expect(templates.length).toBeGreaterThan(0)
    })

    it('should not allow editing system templates', async () => {
      const { data: systemTemplate } = await supabase
        .from('report_templates')
        .select('*')
        .eq('is_system', true)
        .limit(1)
        .single()

      const { error } = await supabase
        .from('report_templates')
        .update({ name: 'Modified Name' })
        .eq('id', systemTemplate.id)

      expect(error).toBeDefined()
    })
  })

  describe('Reports CRUD', () => {
    it('should create a new report', async () => {
      const reportConfig: ReportConfig = {
        name: 'Monthly Inventory Report',
        layout: 'grid',
        components: [],
        dataSources: [],
        filters: [],
        style: { theme: 'light', spacing: 'normal' }
      }

      const { data: report, error } = await supabase
        .from('reports')
        .insert({
          organization_id: testOrgId,
          name: reportConfig.name,
          config: reportConfig,
          created_by: testUserId
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(report).toBeDefined()
      expect(report.name).toBe('Monthly Inventory Report')
      testReportId = report.id
    })

    it('should update report configuration', async () => {
      const updatedConfig: ReportConfig = {
        name: 'Updated Report Name',
        layout: 'flex',
        components: [
          {
            id: 'text-1',
            type: 'text',
            config: { content: 'Test content', alignment: 'center' },
            position: { x: 0, y: 0 },
            size: { width: 12, height: 1 }
          }
        ],
        dataSources: [],
        filters: [],
        style: { theme: 'dark', spacing: 'compact' }
      }

      const { data: updated, error } = await supabase
        .from('reports')
        .update({
          name: updatedConfig.name,
          config: updatedConfig
        })
        .eq('id', testReportId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(updated.name).toBe('Updated Report Name')
      expect(updated.config.layout).toBe('flex')
      expect(updated.config.style.theme).toBe('dark')
    })

    it('should configure report scheduling', async () => {
      const { data: scheduled, error } = await supabase
        .from('reports')
        .update({
          schedule_enabled: true,
          schedule_cron: '0 9 * * MON',
          schedule_timezone: 'America/New_York',
          schedule_recipients: ['admin@example.com', 'user@example.com'],
          schedule_format: ['pdf', 'excel']
        })
        .eq('id', testReportId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(scheduled.schedule_enabled).toBe(true)
      expect(scheduled.schedule_cron).toBe('0 9 * * MON')
      expect(scheduled.schedule_recipients).toHaveLength(2)
    })

    it('should enable report sharing', async () => {
      const { data: shared, error } = await supabase
        .from('reports')
        .update({
          is_shared: true,
          share_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', testReportId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(shared.is_shared).toBe(true)
      expect(shared.share_token).toBeDefined()
      expect(shared.share_expires_at).toBeDefined()
    })
  })

  describe('Report Access Control', () => {
    let otherUserId: string
    let privateReportId: string

    beforeAll(async () => {
      // Create another user in same org
      const { data: { user } } = await supabase.auth.signUp({
        email: 'other-reports-test@example.com',
        password: 'test-password-123'
      })
      
      otherUserId = user!.id

      await supabase
        .from('user_profiles')
        .insert({
          user_id: otherUserId,
          organization_id: testOrgId,
          role: 'user'
        })

      // Create a private report
      const { data: privateReport } = await supabase
        .from('reports')
        .insert({
          organization_id: testOrgId,
          name: 'Private Report',
          config: {
            name: 'Private Report',
            layout: 'grid',
            components: [],
            dataSources: [],
            filters: [],
            style: { theme: 'light', spacing: 'normal' }
          },
          created_by: testUserId,
          access_level: 'private'
        })
        .select()
        .single()

      privateReportId = privateReport.id
    })

    afterAll(async () => {
      await supabase.from('reports').delete().eq('id', privateReportId)
      await supabase.from('user_profiles').delete().eq('user_id', otherUserId)
      await supabase.auth.admin.deleteUser(otherUserId)
    })

    it('should enforce private report access', async () => {
      // Sign in as other user
      const { data: { session } } = await supabase.auth.signInWithPassword({
        email: 'other-reports-test@example.com',
        password: 'test-password-123'
      })

      const userSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${session!.access_token}`
          }
        }
      })

      const { data: reports } = await userSupabase
        .from('reports')
        .select('*')
        .eq('id', privateReportId)

      expect(reports).toHaveLength(0)
    })

    it('should allow team access to team reports', async () => {
      // Update to team access
      await supabase
        .from('reports')
        .update({ access_level: 'team' })
        .eq('id', privateReportId)

      // Sign in as other user
      const { data: { session } } = await supabase.auth.signInWithPassword({
        email: 'other-reports-test@example.com',
        password: 'test-password-123'
      })

      const userSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${session!.access_token}`
          }
        }
      })

      const { data: reports } = await userSupabase
        .from('reports')
        .select('*')
        .eq('id', privateReportId)

      expect(reports).toHaveLength(1)
    })
  })

  describe('Report Runs', () => {
    it('should create a report run', async () => {
      const { data: run, error } = await supabase
        .from('report_runs')
        .insert({
          report_id: testReportId,
          status: 'pending',
          parameters: { dateRange: 'last30days' }
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(run).toBeDefined()
      expect(run.status).toBe('pending')
    })

    it('should update run status', async () => {
      const { data: run } = await supabase
        .from('report_runs')
        .insert({
          report_id: testReportId,
          status: 'running'
        })
        .select()
        .single()

      const { data: completed } = await supabase
        .from('report_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result_url: 'https://storage.example.com/report.pdf',
          result_size_bytes: 512000,
          record_count: 250,
          delivery_status: [
            {
              email: 'user@example.com',
              status: 'sent',
              timestamp: new Date().toISOString()
            }
          ]
        })
        .eq('id', run.id)
        .select()
        .single()

      expect(completed.status).toBe('completed')
      expect(completed.result_url).toBeDefined()
      expect(completed.delivery_status).toHaveLength(1)
    })
  })

  describe('Report Components', () => {
    it('should have default report components', async () => {
      const { data: components } = await supabase
        .from('report_components')
        .select('*')
        .eq('is_active', true)

      expect(components).toBeDefined()
      expect(components.length).toBeGreaterThan(0)

      const componentTypes = components.map(c => c.type)
      expect(componentTypes).toContain('chart')
      expect(componentTypes).toContain('table')
      expect(componentTypes).toContain('metric')
      expect(componentTypes).toContain('text')
      expect(componentTypes).toContain('filter')
    })
  })

  describe('Query Execution', () => {
    it('should execute safe queries', async () => {
      const { data, error } = await supabase.rpc('execute_report_query', {
        query: 'SELECT COUNT(*) as count FROM organizations',
        parameters: {}
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should block unsafe queries', async () => {
      const { error } = await supabase.rpc('execute_report_query', {
        query: 'DELETE FROM organizations',
        parameters: {}
      })

      expect(error).toBeDefined()
      expect(error.message).toContain('read-only')
    })
  })
})