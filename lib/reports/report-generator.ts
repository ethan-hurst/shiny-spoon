import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { generateCSV } from '@/lib/csv/parser'
import { createServerClient } from '@/lib/supabase/server'
import 'jspdf-autotable'
import type { ExportFormat, ReportConfig } from '@/types/reports.types'

export class ReportGenerator {
  private supabase: ReturnType<typeof createServerClient>

  constructor() {
    this.supabase = createServerClient()
  }

  async generate(
    report: ReportConfig,
    format: ExportFormat,
    parameters?: Record<string, any>
  ): Promise<{ data: Buffer | string; mimeType: string }> {
    // Fetch data for all data sources
    const data = await this.fetchReportData(report, parameters)

    // Generate report in requested format
    switch (format) {
      case 'csv':
        return this.generateCSV(report, data)
      case 'excel':
        return this.generateExcel(report, data)
      case 'pdf':
        return this.generatePDF(report, data)
      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }

  private async fetchReportData(
    report: ReportConfig,
    parameters?: Record<string, any>
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = {}

    for (const dataSource of report.dataSources) {
      switch (dataSource.type) {
        case 'query':
          const { data: queryResult, error } = await this.supabase.rpc(
            'execute_report_query',
            {
              query: dataSource.query,
              parameters: {
                ...parameters,
                orgId: parameters?.organizationId,
              },
            }
          )

          if (error) throw error
          data[dataSource.id] = queryResult
          break

        case 'analytics':
          // Fetch from analytics metrics
          const { data: metricsResult } = await this.supabase
            .from('analytics_metrics')
            .select('*')
            .eq('metric_type', dataSource.metric)
            .eq('organization_id', parameters?.organizationId)
            .order('metric_date', { ascending: false })
            .limit(dataSource.limit || 100)

          data[dataSource.id] = metricsResult
          break
      }
    }

    return data
  }

  private generateCSV(
    report: ReportConfig,
    data: Record<string, any>
  ): { data: string; mimeType: string } {
    // Find the first table component
    const tableComponent = report.components.find((c) => c.type === 'table')

    if (!tableComponent) {
      throw new Error('No table component found for CSV export')
    }

    const tableData = data[tableComponent.config.dataSource]
    const columns = tableComponent.config.columns

    const csv = generateCSV(
      tableData,
      columns.map((col: any) => ({
        key: col.field,
        header: col.label,
      }))
    )

    return {
      data: csv,
      mimeType: 'text/csv',
    }
  }

  private generateExcel(
    report: ReportConfig,
    data: Record<string, any>
  ): { data: Buffer; mimeType: string } {
    const workbook = XLSX.utils.book_new()

    // Add metadata
    workbook.Props = {
      Title: report.name,
      Created: new Date(),
    }

    // Create sheets for each data table
    report.components
      .filter((c) => c.type === 'table')
      .forEach((component, index) => {
        const sheetData = data[component.config.dataSource]
        if (!sheetData || !Array.isArray(sheetData)) return

        const worksheet = XLSX.utils.json_to_sheet(sheetData)

        // Add to workbook
        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          component.config.title || `Sheet${index + 1}`
        )
      })

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return {
      data: buffer,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  }

  private generatePDF(
    report: ReportConfig,
    data: Record<string, any>
  ): { data: Buffer; mimeType: string } {
    const doc = new jsPDF()
    let yPosition = 20

    // Add title
    doc.setFontSize(20)
    doc.text(report.name, 20, yPosition)
    yPosition += 20

    // Add generated date
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition)
    yPosition += 20

    // Process components
    report.components.forEach((component) => {
      switch (component.type) {
        case 'text':
          doc.setFontSize(12)
          const text = component.config.content.replace(/<[^>]*>/g, '') // Strip HTML
          const lines = doc.splitTextToSize(text, 170)
          doc.text(lines, 20, yPosition)
          yPosition += lines.length * 7
          break

        case 'metric':
          doc.setFontSize(14)
          doc.text(component.config.title, 20, yPosition)
          yPosition += 10

          const metricValue = this.calculateMetric(
            data[component.config.dataSource],
            component.config
          )
          doc.setFontSize(20)
          doc.text(String(metricValue), 20, yPosition)
          yPosition += 20
          break

        case 'table':
          const tableData = data[component.config.dataSource]
          if (tableData && tableData.length > 0) {
            const headers = component.config.columns.map(
              (col: any) => col.label
            )
            const rows = tableData.map((row: any) =>
              component.config.columns.map((col: any) => row[col.field])
            )

            ;(doc as any).autoTable({
              head: [headers],
              body: rows,
              startY: yPosition,
              margin: { left: 20, right: 20 },
            })

            yPosition = (doc as any).lastAutoTable.finalY + 20
          }
          break

        // Add more component types as needed
      }

      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
    })

    // Convert to buffer
    const pdfData = doc.output('arraybuffer')

    return {
      data: Buffer.from(pdfData),
      mimeType: 'application/pdf',
    }
  }

  private calculateMetric(data: any[], config: any): string {
    if (!data || data.length === 0) return '0'

    const values = data.map((row) => Number(row[config.metric]) || 0)

    let result: number
    switch (config.aggregation) {
      case 'sum':
        result = values.reduce((a, b) => a + b, 0)
        break
      case 'avg':
        result = values.reduce((a, b) => a + b, 0) / values.length
        break
      case 'count':
        result = values.length
        break
      case 'min':
        result = Math.min(...values)
        break
      case 'max':
        result = Math.max(...values)
        break
      default:
        result = 0
    }

    // Format result
    switch (config.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(result)
      case 'percentage':
        return `${(result * 100).toFixed(1)}%`
      default:
        return new Intl.NumberFormat('en-US').format(result)
    }
  }
}