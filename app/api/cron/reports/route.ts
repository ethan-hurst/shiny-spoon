import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ReportGenerator } from '@/lib/reports/report-generator'
import { Resend } from 'resend'
import type { Report } from '@/types/reports.types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    
    // Get all scheduled reports that should run
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*')
      .eq('schedule_enabled', true)
      .not('schedule_cron', 'is', null)

    if (error) {
      console.error('Failed to fetch scheduled reports:', error)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    const results = []
    
    for (const report of reports || []) {
      try {
        // Check if report should run based on cron expression
        // This is a simplified check - in production use a proper cron parser
        if (!shouldRunReport(report, now)) {
          continue
        }

        // Create run record
        const { data: run, error: runError } = await supabase
          .from('report_runs')
          .insert({
            report_id: report.id,
            status: 'running',
            started_at: now.toISOString()
          })
          .select()
          .single()

        if (runError || !run) {
          console.error('Failed to create report run:', runError)
          continue
        }

        const generator = new ReportGenerator()
        const deliveryStatus: any[] = []
        const formats = report.schedule_format || ['pdf']
        const recipients = report.schedule_recipients || []

        for (const format of formats) {
          try {
            // Generate report
            const result = await generator.generate(
              report.config,
              format as any,
              {
                organizationId: report.organization_id,
                reportId: report.id,
                runId: run.id
              }
            )

            // Upload to storage
            const filename = `${report.id}/${run.id}/${report.name}-${now.toISOString()}.${format}`
            const { error: uploadError } = await supabase.storage
              .from('reports')
              .upload(filename, result.data, {
                contentType: result.mimeType
              })

            if (uploadError) {
              throw new Error(`Failed to upload: ${uploadError.message}`)
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('reports')
              .getPublicUrl(filename)

            // Send emails
            for (const recipient of recipients) {
              try {
                await resend.emails.send({
                  from: 'Reports <reports@yourdomain.com>',
                  to: recipient,
                  subject: `${report.name} - ${now.toLocaleDateString()}`,
                  html: `
                    <h2>${report.name}</h2>
                    <p>Your scheduled report is ready.</p>
                    <p><a href="${publicUrl}">Download ${format.toUpperCase()}</a></p>
                    <p>This report was generated on ${now.toLocaleString()}.</p>
                  `
                })

                deliveryStatus.push({
                  email: recipient,
                  format,
                  status: 'sent',
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
              await supabase
                .from('report_runs')
                .update({
                  result_url: publicUrl,
                  result_size_bytes: Buffer.byteLength(result.data)
                })
                .eq('id', run.id)
            }
          } catch (error) {
            console.error(`Failed to generate ${format} for report ${report.id}:`, error)
          }
        }

        // Mark as completed
        await supabase
          .from('report_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            delivery_status: deliveryStatus
          })
          .eq('id', run.id)

        // Update report last run
        await supabase
          .from('reports')
          .update({
            last_run_at: new Date().toISOString(),
            run_count: report.run_count + 1
          })
          .eq('id', report.id)

        results.push({
          reportId: report.id,
          reportName: report.name,
          status: 'success',
          recipients: recipients.length
        })

      } catch (error) {
        console.error(`Failed to process report ${report.id}:`, error)
        
        results.push({
          reportId: report.id,
          reportName: report.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function shouldRunReport(report: Report, now: Date): boolean {
  // This is a simplified implementation
  // In production, use a proper cron parser like node-cron
  
  const cron = report.schedule_cron
  if (!cron) return false

  // Example: "0 9 * * MON" - Every Monday at 9 AM
  // For now, just check if it's the right hour
  const hour = now.getHours()
  const cronParts = cron.split(' ')
  
  if (cronParts[1] === '*') return true
  if (parseInt(cronParts[1]) === hour) return true
  
  return false
}