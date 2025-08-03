'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  LineChart,
  PieChart,
  Table,
  Card as CardIcon,
  Type,
  Image,
  Filter,
  TrendingUp,
  Activity,
} from 'lucide-react'
import type { ReportPreviewProps } from '@/types/reports.types'

const COMPONENT_ICONS = {
  chart: BarChart,
  table: Table,
  metric: CardIcon,
  text: Type,
  image: Image,
  filter: Filter,
}

export function ReportPreview({ config }: ReportPreviewProps) {
  const renderComponent = (component: any, index: number) => {
    const Icon = COMPONENT_ICONS[component.type] || BarChart

    switch (component.type) {
      case 'chart':
        return (
          <Card key={component.id} className="col-span-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {component.config.title || 'Chart'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted/20 rounded flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Icon className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm">{component.config.chartType || 'bar'} Chart</p>
                  <p className="text-xs mt-1">
                    {component.config.xAxis && component.config.yAxis
                      ? `${component.config.xAxis} vs ${component.config.yAxis}`
                      : 'Configure data fields'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 'table':
        return (
          <Card key={component.id} className="col-span-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {component.config.title || 'Data Table'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded">
                <div className="bg-muted/20 p-4 text-center text-muted-foreground">
                  <Icon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Data Table</p>
                  <p className="text-xs mt-1">
                    {component.config.pageSize || 25} rows per page
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 'metric':
        return (
          <Card key={component.id} className="col-span-3">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {component.config.title || 'Metric'}
                </span>
              </div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-xs text-muted-foreground mt-1">
                {component.config.aggregation || 'sum'} of{' '}
                {component.config.metricField || 'value'}
              </div>
            </CardContent>
          </Card>
        )

      case 'text':
        return (
          <Card key={component.id} className="col-span-12">
            <CardContent className="p-6">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: component.config.content || '<p>Text content...</p>',
                }}
              />
            </CardContent>
          </Card>
        )

      case 'image':
        return (
          <Card key={component.id} className="col-span-6">
            <CardContent className="p-6">
              <div className="h-32 bg-muted/20 rounded flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Icon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">{component.config.alt || 'Image'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 'filter':
        return (
          <Card key={component.id} className="col-span-12">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {component.config.label || 'Filter'}
                </span>
                <Badge variant="outline" className="text-xs">
                  {component.config.defaultRange || 'last30days'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return (
          <Card key={component.id} className="col-span-12">
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">
                <p className="text-sm">Unknown component type</p>
              </div>
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-4xl mx-auto">
        {/* Report Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2">{config.name}</h1>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>Generated on {new Date().toLocaleDateString()}</span>
            <span>•</span>
            <span>{config.components.length} components</span>
          </div>
        </div>

        {/* Report Content */}
        <div className="grid grid-cols-12 gap-4">
          {config.components.length === 0 ? (
            <div className="col-span-12 text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium mb-2">No components</p>
              <p className="text-sm">Add components to see the report preview</p>
            </div>
          ) : (
            config.components.map((component, index) => renderComponent(component, index))
          )}
        </div>

        {/* Report Footer */}
        <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground">
          <p>TruthSource Report Builder</p>
        </div>
      </div>
    </div>
  )
} 