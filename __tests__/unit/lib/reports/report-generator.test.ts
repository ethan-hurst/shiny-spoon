import { ReportGenerator } from '@/lib/reports/report-generator'
import { createServerClient } from '@/lib/supabase/server'
import type { ReportConfig } from '@/types/reports.types'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('jspdf')
jest.mock('xlsx')
jest.mock('@/lib/csv/parser', () => ({
  generateCSV: jest.fn((data, columns) => 'mocked-csv-content')
}))

const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: [{ id: 1, value: 100 }],
              error: null
            }))
          }))
        }))
      }))
    }))
  }))
}

;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)

describe('ReportGenerator', () => {
  let generator: ReportGenerator
  let mockReport: ReportConfig

  beforeEach(() => {
    jest.clearAllMocks()
    generator = new ReportGenerator()
    
    mockReport = {
      name: 'Test Report',
      layout: 'grid',
      components: [
        {
          id: 'table-1',
          type: 'table',
          config: {
            title: 'Test Table',
            dataSource: 'test-data',
            columns: [
              { field: 'id', label: 'ID' },
              { field: 'name', label: 'Name' }
            ]
          },
          position: { x: 0, y: 0 },
          size: { width: 12, height: 6 }
        },
        {
          id: 'metric-1',
          type: 'metric',
          config: {
            title: 'Total Value',
            dataSource: 'test-data',
            metric: 'value',
            aggregation: 'sum',
            format: 'currency'
          },
          position: { x: 0, y: 6 },
          size: { width: 4, height: 2 }
        }
      ],
      dataSources: [
        {
          id: 'test-data',
          type: 'query',
          query: 'SELECT * FROM test_table'
        }
      ],
      filters: [],
      style: { theme: 'light', spacing: 'normal' }
    }
  })

  describe('generate', () => {
    it('generates CSV format', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          { id: 1, name: 'Item 1', value: 100 },
          { id: 2, name: 'Item 2', value: 200 }
        ],
        error: null
      })

      const result = await generator.generate(mockReport, 'csv', {
        organizationId: 'org-123'
      })

      expect(result.data).toBe('mocked-csv-content')
      expect(result.mimeType).toBe('text/csv')
    })

    it('generates Excel format', async () => {
      const mockBuffer = Buffer.from('excel-data')
      ;(XLSX.write as jest.Mock).mockReturnValue(mockBuffer)
      ;(XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue({})
      ;(XLSX.utils.book_new as jest.Mock).mockReturnValue({})
      ;(XLSX.utils.book_append_sheet as jest.Mock).mockReturnValue(undefined)

      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: 1, name: 'Item 1' }],
        error: null
      })

      const result = await generator.generate(mockReport, 'excel', {
        organizationId: 'org-123'
      })

      expect(result.data).toEqual(mockBuffer)
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })

    it('generates PDF format', async () => {
      const mockPdf = {
        text: jest.fn(),
        setFontSize: jest.fn(),
        addPage: jest.fn(),
        splitTextToSize: jest.fn(() => ['line1', 'line2']),
        output: jest.fn(() => new ArrayBuffer(8)),
        autoTable: jest.fn()
      }
      ;(jsPDF as unknown as jest.Mock).mockImplementation(() => mockPdf)

      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: 1, name: 'Item 1' }],
        error: null
      })

      const result = await generator.generate(mockReport, 'pdf', {
        organizationId: 'org-123'
      })

      expect(result.data).toBeInstanceOf(Buffer)
      expect(result.mimeType).toBe('application/pdf')
      expect(mockPdf.text).toHaveBeenCalledWith('Test Report', 20, 20)
    })

    it('throws error for unsupported format', async () => {
      await expect(
        generator.generate(mockReport, 'invalid' as any, {})
      ).rejects.toThrow('Unsupported format: invalid')
    })
  })

  describe('fetchReportData', () => {
    it('fetches query data sources', async () => {
      const mockData = [{ id: 1, value: 100 }]
      mockSupabase.rpc.mockResolvedValue({
        data: mockData,
        error: null
      })

      const generator = new ReportGenerator()
      const data = await (generator as any).fetchReportData(mockReport, {
        organizationId: 'org-123'
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('execute_report_query', {
        query: 'SELECT * FROM test_table',
        parameters: {
          organizationId: 'org-123',
          orgId: 'org-123'
        }
      })
      expect(data['test-data']).toEqual(mockData)
    })

    it('fetches analytics data sources', async () => {
      const analyticsReport = {
        ...mockReport,
        dataSources: [
          {
            id: 'analytics-data',
            type: 'analytics' as const,
            metric: 'inventory_value',
            limit: 50
          }
        ]
      }

      const generator = new ReportGenerator()
      await (generator as any).fetchReportData(analyticsReport, {
        organizationId: 'org-123'
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('analytics_metrics')
    })

    it('handles RPC errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error('RPC failed')
      })

      const generator = new ReportGenerator()
      await expect(
        (generator as any).fetchReportData(mockReport, {})
      ).rejects.toThrow('RPC failed')
    })
  })

  describe('CSV generation', () => {
    it('throws error when no table component exists', async () => {
      const noTableReport = {
        ...mockReport,
        components: mockReport.components.filter(c => c.type !== 'table')
      }

      const generator = new ReportGenerator()
      expect(() =>
        (generator as any).generateCSV(noTableReport, {})
      ).toThrow('No table component found for CSV export')
    })
  })

  describe('metric calculation', () => {
    const testData = [
      { value: 10 },
      { value: 20 },
      { value: 30 }
    ]

    it('calculates sum aggregation', () => {
      const generator = new ReportGenerator()
      const result = (generator as any).calculateMetric(testData, {
        metric: 'value',
        aggregation: 'sum',
        format: 'number'
      })
      expect(result).toBe('60')
    })

    it('calculates average aggregation', () => {
      const generator = new ReportGenerator()
      const result = (generator as any).calculateMetric(testData, {
        metric: 'value',
        aggregation: 'avg',
        format: 'number'
      })
      expect(result).toBe('20')
    })

    it('calculates count aggregation', () => {
      const generator = new ReportGenerator()
      const result = (generator as any).calculateMetric(testData, {
        metric: 'value',
        aggregation: 'count',
        format: 'number'
      })
      expect(result).toBe('3')
    })

    it('formats currency values', () => {
      const generator = new ReportGenerator()
      const result = (generator as any).calculateMetric([{ value: 1000 }], {
        metric: 'value',
        aggregation: 'sum',
        format: 'currency'
      })
      expect(result).toBe('$1,000.00')
    })

    it('formats percentage values', () => {
      const generator = new ReportGenerator()
      const result = (generator as any).calculateMetric([{ value: 0.85 }], {
        metric: 'value',
        aggregation: 'sum',
        format: 'percentage'
      })
      expect(result).toBe('85.0%')
    })

    it('handles empty data', () => {
      const generator = new ReportGenerator()
      const result = (generator as any).calculateMetric([], {
        metric: 'value',
        aggregation: 'sum',
        format: 'number'
      })
      expect(result).toBe('0')
    })
  })
})