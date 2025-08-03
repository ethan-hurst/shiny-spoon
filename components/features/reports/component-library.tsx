'use client'

import { useDraggable } from '@dnd-kit/core'
import {
  BarChart,
  LineChart,
  PieChart,
  Table,
  Card as CardIcon,
  Type,
  Image,
  Filter,
  BarChart3,
  Activity,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { ComponentType } from '@/types/reports.types'

interface ComponentLibraryItem {
  id: string
  name: string
  type: ComponentType
  category: string
  icon: React.ComponentType<any>
  description: string
  defaultConfig: Record<string, any>
}

const COMPONENT_LIBRARY: ComponentLibraryItem[] = [
  {
    id: 'bar-chart',
    name: 'Bar Chart',
    type: 'chart',
    category: 'Visualizations',
    icon: BarChart,
    description: 'Display data as vertical or horizontal bars',
    defaultConfig: {
      title: 'Bar Chart',
      chartType: 'bar',
      xAxis: '',
      yAxis: '',
      color: 'hsl(var(--chart-1))',
    },
  },
  {
    id: 'line-chart',
    name: 'Line Chart',
    type: 'chart',
    category: 'Visualizations',
    icon: LineChart,
    description: 'Show trends over time with connected points',
    defaultConfig: {
      title: 'Line Chart',
      chartType: 'line',
      xAxis: '',
      yAxis: '',
      lines: [],
    },
  },
  {
    id: 'pie-chart',
    name: 'Pie Chart',
    type: 'chart',
    category: 'Visualizations',
    icon: PieChart,
    description: 'Display proportions as circular segments',
    defaultConfig: {
      title: 'Pie Chart',
      chartType: 'pie',
      dataField: '',
      labelField: '',
    },
  },
  {
    id: 'data-table',
    name: 'Data Table',
    type: 'table',
    category: 'Data',
    icon: Table,
    description: 'Display data in a sortable, filterable table',
    defaultConfig: {
      title: 'Data Table',
      columns: [],
      pageSize: 25,
      sortable: true,
      filterable: true,
    },
  },
  {
    id: 'metric-card',
    name: 'Metric Card',
    type: 'metric',
    category: 'KPIs',
    icon: CardIcon,
    description: 'Display key performance indicators',
    defaultConfig: {
      title: 'Metric',
      aggregation: 'sum',
      format: 'number',
      comparison: false,
      target: null,
    },
  },
  {
    id: 'text-block',
    name: 'Text Block',
    type: 'text',
    category: 'Content',
    icon: Type,
    description: 'Add rich text content and descriptions',
    defaultConfig: {
      content: '<p>Enter your text here...</p>',
      alignment: 'left',
      fontSize: 'base',
    },
  },
  {
    id: 'image',
    name: 'Image',
    type: 'image',
    category: 'Content',
    icon: Image,
    description: 'Add images, logos, or visual content',
    defaultConfig: {
      src: '',
      alt: '',
      width: 'auto',
      height: 'auto',
    },
  },
  {
    id: 'date-filter',
    name: 'Date Range Filter',
    type: 'filter',
    category: 'Filters',
    icon: Filter,
    description: 'Filter data by date range',
    defaultConfig: {
      label: 'Date Range',
      defaultRange: 'last30days',
      allowCustom: true,
    },
  },
  {
    id: 'trend-chart',
    name: 'Trend Chart',
    type: 'chart',
    category: 'Visualizations',
    icon: TrendingUp,
    description: 'Show trends with area charts',
    defaultConfig: {
      title: 'Trend Chart',
      chartType: 'area',
      xAxis: '',
      yAxis: '',
      fill: true,
    },
  },
  {
    id: 'kpi-dashboard',
    name: 'KPI Dashboard',
    type: 'metric',
    category: 'KPIs',
    icon: Activity,
    description: 'Multiple metrics in a dashboard layout',
    defaultConfig: {
      title: 'KPI Dashboard',
      metrics: [],
      layout: 'grid',
    },
  },
]

function DraggableComponent({ component }: { component: ComponentLibraryItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: component.id,
    data: {
      type: 'library-component',
      componentType: component.type,
      defaultConfig: component.defaultConfig,
    },
  })

  const Icon = component.icon

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{component.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {component.description}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ComponentLibrary() {
  const categories = Array.from(
    new Set(COMPONENT_LIBRARY.map((component) => component.category))
  )

  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category}>
          <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {category}
          </h4>
          <div className="space-y-2">
            {COMPONENT_LIBRARY
              .filter((component) => component.category === category)
              .map((component) => (
                <DraggableComponent key={component.id} component={component} />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
} 