'use client'

import { useEffect, useState } from 'react'
import { REPORT_COMPONENTS } from '@/lib/reports/report-components'
import { cn } from '@/lib/utils'
import type { ReportConfig } from '@/types/reports.types'
import { Skeleton } from '@/components/ui/skeleton'

interface ReportPreviewProps {
  config: ReportConfig
}

export function ReportPreview({ config }: ReportPreviewProps) {
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string, any>>({})

  useEffect(() => {
    // Simulate data fetching
    const fetchData = async () => {
      setLoading(true)
      
      // Mock data for each data source
      const mockData: Record<string, any> = {}
      
      for (const dataSource of config.dataSources) {
        if (dataSource.type === 'query') {
          // Mock query results
          mockData[dataSource.id] = generateMockData(dataSource.id)
        } else if (dataSource.type === 'analytics') {
          // Mock analytics data
          mockData[dataSource.id] = generateMockAnalyticsData(dataSource.metric || 'default')
        }
      }
      
      setData(mockData)
      setLoading(false)
    }

    fetchData()
  }, [config.dataSources])

  const handleFilterChange = (filterId: string, value: any) => {
    setFilters(prev => ({ ...prev, [filterId]: value }))
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "p-8",
        config.style.theme === 'dark' && "dark",
        config.style.spacing === 'compact' && "space-y-2",
        config.style.spacing === 'normal' && "space-y-4",
        config.style.spacing === 'relaxed' && "space-y-6"
      )}
    >
      {config.layout === 'grid' ? (
        <div className="grid grid-cols-12 gap-4">
          {config.components.map((component) => {
            const componentDef = REPORT_COMPONENTS.find(c => c.type === component.type)
            if (!componentDef) return null

            const Component = componentDef.render
            const componentData = component.config.dataSource ? 
              data[component.config.dataSource] : null

            return (
              <div
                key={component.id}
                className={`col-span-${component.size.width}`}
                style={{ minHeight: `${component.size.height * 100}px` }}
              >
                <Component 
                  config={component.config} 
                  data={componentData}
                  onChange={component.type === 'filter' ? 
                    (value: any) => handleFilterChange(component.id, value) : 
                    undefined
                  }
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {config.components.map((component) => {
            const componentDef = REPORT_COMPONENTS.find(c => c.type === component.type)
            if (!componentDef) return null

            const Component = componentDef.render
            const componentData = component.config.dataSource ? 
              data[component.config.dataSource] : null

            return (
              <div key={component.id}>
                <Component 
                  config={component.config} 
                  data={componentData}
                  onChange={component.type === 'filter' ? 
                    (value: any) => handleFilterChange(component.id, value) : 
                    undefined
                  }
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Mock data generators
function generateMockData(dataSourceId: string): any[] {
  if (dataSourceId.includes('inventory')) {
    return [
      { warehouse: 'Main Warehouse', total_value: 125000, sku_count: 450, low_stock_count: 12 },
      { warehouse: 'East Coast', total_value: 87500, sku_count: 320, low_stock_count: 8 },
      { warehouse: 'West Coast', total_value: 98000, sku_count: 380, low_stock_count: 15 },
      { warehouse: 'Central', total_value: 56000, sku_count: 210, low_stock_count: 5 },
    ]
  }

  if (dataSourceId.includes('trend')) {
    return Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_value: 350000 + Math.random() * 50000,
      total_quantity: 1500 + Math.floor(Math.random() * 200)
    }))
  }

  if (dataSourceId.includes('low_stock')) {
    return [
      { sku: 'PRD-001', product_name: 'Widget A', current_quantity: 5, reorder_point: 10, warehouse: 'Main' },
      { sku: 'PRD-024', product_name: 'Gadget B', current_quantity: 3, reorder_point: 15, warehouse: 'East' },
      { sku: 'PRD-056', product_name: 'Tool C', current_quantity: 8, reorder_point: 20, warehouse: 'West' },
      { sku: 'PRD-089', product_name: 'Device D', current_quantity: 2, reorder_point: 10, warehouse: 'Central' },
    ]
  }

  // Default mock data
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    value: Math.floor(Math.random() * 1000),
    status: Math.random() > 0.5 ? 'active' : 'inactive'
  }))
}

function generateMockAnalyticsData(metric: string): any[] {
  switch (metric) {
    case 'inventory_value':
      return Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: 350000 + Math.random() * 50000
      }))
    
    case 'order_accuracy':
      return Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        accuracy: 94 + Math.random() * 5
      }))
    
    default:
      return []
  }
}