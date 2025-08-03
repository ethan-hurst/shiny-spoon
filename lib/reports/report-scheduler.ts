import { createServerClient } from '@/lib/supabase/server'
import { ReportGenerator } from './report-generator'
import { Resend } from 'resend'
import * as cron from 'node-cron'
import type { Report, ReportRun } from '@/types/reports.types'

const resend = new Resend(process.env.RESEND_API_KEY)

export class ReportScheduler {
  private supabase: ReturnType<typeof createServerClient>
  private generator: ReportGenerator
  private tasks: Map<string, cron.ScheduledTask> = new Map()

  constructor() {
    this.supabase = createServerClient()
    this.generator = new ReportGenerator()
  }

  async initialize() {
    // Load all scheduled reports and create cron jobs
    const { data: reports } = await this.supabase
      .from('reports')
      .select('*')
      .eq('schedule_enabled', true)

    if (reports) {
      for (const report of reports) {
        this.scheduleReport(report)
      }
    }
  }

  scheduleReport(report: Report) {
    // Remove existing task if any
    this.unscheduleReport(report.id)

    if (!report.schedule_enabled || !report.schedule_cron) {
      return
    }

    // Validate cron expression
    if (!cron.validate(report.schedule_cron)) {
      console.error(`Invalid cron expression for report ${report.id}: ${report.schedule_cron}`)
      return
    }

    // Create new task
    const task = cron.schedule(
      report.schedule_cron,
      async () => {
        await this.runScheduledReport(report)
      },
      {
        scheduled: true,
        timezone: report.schedule_timezone || 'UTC'
      }
    )

    this.tasks.set(report.id, task)
  }

  unscheduleReport(reportId: string) {
    const task = this.tasks.get(reportId)
    if (task) {
      task.stop()
      this.tasks.delete(reportId)
    }
  }

  async runScheduledReport(report: Report) {
    console.log(`Running scheduled report: ${report.name} (${report.id})`)

    // Create run record
    const { data: run, error: runError } = await this.supabase
      .from('report_runs')
      .insert({
        report_id: report.id,
        status: 'running',
        started_at: new Date().toISOString(),
        parameters: {}
      })
      .select()
      .single()

    if (runError || !run) {
      console.error('Failed to create report run:', runError)
      return
    }

    try {
      const deliveryStatus: any[] = []
      const formats = report.schedule_format || ['pdf']
      const recipients = report.schedule_recipients || []

      for (const format of formats) {
        // Generate report
        const result = await this.generator.generate(
          report.config,
          format as any,
          {
            organizationId: report.organization_id,
            reportId: report.id,
            runId: run.id
          }
        )

        // Upload to storage
        const filename = `${report.id}/${run.id}/${report.name}-${new Date().toISOString()}.${format}`
        const { data: upload, error: uploadError } = await this.supabase.storage
          .from('reports')
          .upload(filename, result.data, {
            contentType: result.mimeType
          })

        if (uploadError) {
          throw new Error(`Failed to upload report: ${uploadError.message}`)
        }

        // Get public URL
        const { data: { publicUrl } } = this.supabase.storage
          .from('reports')
          .getPublicUrl(filename)

        // Send emails
        for (const recipient of recipients) {
          try {
            const { data: emailData, error: emailError } = await resend.emails.send({
              from: 'Reports <reports@yourdomain.com>',
              to: recipient,
              subject: `${report.name} - ${new Date().toLocaleDateString()}`,
              html: `
                <h2>${report.name}</h2>
                <p>Your scheduled report is ready.</p>
                <p><a href="${publicUrl}">Download ${format.toUpperCase()}</a></p>
                <p>This report was generated on ${new Date().toLocaleString()}.</p>
              `
            })

            deliveryStatus.push({
              email: recipient,
              format,
              status: emailError ? 'failed' : 'sent',
              error: emailError?.message,
              timestamp: new Date().toISOString()
            })
          } catch (error) {
            deliveryStatus.push({
              email: recipient,
              format,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            })
          }
        }

        // Update run with first format URL
        if (formats.indexOf(format) === 0) {
          await this.supabase
            .from('report_runs')
            .update({
              result_url: publicUrl,
              result_size_bytes: Buffer.byteLength(result.data)
            })
            .eq('id', run.id)
        }
      }

      // Mark as completed
      await this.supabase
        .from('report_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          delivery_status: deliveryStatus,
          record_count: 0 // TODO: Calculate from actual data
        })
        .eq('id', run.id)

      // Update report last run
      await this.supabase
        .from('reports')
        .update({
          last_run_at: new Date().toISOString(),
          run_count: report.run_count + 1
        })
        .eq('id', report.id)

    } catch (error) {
      console.error('Failed to run scheduled report:', error)

      // Mark as failed
      await this.supabase
        .from('report_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', run.id)
    }
  }

  async updateSchedule(reportId: string) {
    // Fetch updated report
    const { data: report } = await this.supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (report) {
      this.scheduleReport(report)
    } else {
      this.unscheduleReport(reportId)
    }
  }

  shutdown() {
    // Stop all scheduled tasks
    for (const task of this.tasks.values()) {
      task.stop()
    }
    this.tasks.clear()
  }
}

// Global instance
let scheduler: ReportScheduler | null = null

export function getReportScheduler() {
  if (!scheduler) {
    scheduler = new ReportScheduler()
    scheduler.initialize()
  }
  return scheduler
}