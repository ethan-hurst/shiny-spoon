import {
  BarChart,
  LineChart,
  PieChart,
  Table,
  Card as CardIcon,
  Type,
  Image,
  Filter
} from 'lucide-react'
import type { ComponentType } from '@/types/reports.types'

export interface ReportComponentDefinition {
  id: string
  name: string
  type: ComponentType
  category: string
  icon: React.ElementType
  configSchema: Record<string, any>
  defaultConfig: Record<string, any>
  preview: React.ComponentType<{ config: any }>
  render: React.ComponentType<{ config: any; data: any; onChange?: (value: any) => void }>
}

export const REPORT_COMPONENTS: ReportComponentDefinition[] = [
  {
    id: 'bar-chart',
    name: 'Bar Chart',
    type: 'chart',
    category: 'Visualizations',
    icon: BarChart,
    configSchema: {
      title: { type: 'string', label: 'Title' },
      dataSource: { type: 'select', label: 'Data Source' },
      xAxis: { type: 'field', label: 'X Axis' },
      yAxis: { type: 'field', label: 'Y Axis' },
      color: { type: 'color', label: 'Color' }
    },
    defaultConfig: {
      title: 'Bar Chart',
      xAxis: '',
      yAxis: '',
      color: 'hsl(var(--chart-1))'
    },
    preview: BarChartPreview,
    render: BarChartComponent
  },
  {
    id: 'line-chart',
    name: 'Line Chart',
    type: 'chart',
    category: 'Visualizations',
    icon: LineChart,
    configSchema: {
      title: { type: 'string', label: 'Title' },
      dataSource: { type: 'select', label: 'Data Source' },
      xAxis: { type: 'field', label: 'X Axis' },
      yAxis: { type: 'field', label: 'Y Axis' },
      lines: { type: 'multi-field', label: 'Lines' }
    },
    defaultConfig: {
      title: 'Line Chart',
      xAxis: '',
      yAxis: '',
      lines: []
    },
    preview: LineChartPreview,
    render: LineChartComponent
  },
  {
    id: 'pie-chart',
    name: 'Pie Chart',
    type: 'chart',
    category: 'Visualizations',
    icon: PieChart,
    configSchema: {
      title: { type: 'string', label: 'Title' },
      dataSource: { type: 'select', label: 'Data Source' },
      labelField: { type: 'field', label: 'Label Field' },
      valueField: { type: 'field', label: 'Value Field' }
    },
    defaultConfig: {
      title: 'Pie Chart',
      labelField: '',
      valueField: ''
    },
    preview: PieChartPreview,
    render: PieChartComponent
  },
  {
    id: 'data-table',
    name: 'Data Table',
    type: 'table',
    category: 'Data',
    icon: Table,
    configSchema: {
      title: { type: 'string', label: 'Title' },
      dataSource: { type: 'select', label: 'Data Source' },
      columns: { type: 'columns', label: 'Columns' },
      pageSize: { type: 'number', label: 'Page Size', min: 10, max: 100 }
    },
    defaultConfig: {
      title: 'Data Table',
      columns: [],
      pageSize: 25
    },
    preview: DataTablePreview,
    render: DataTableComponent
  },
  {
    id: 'metric-card',
    name: 'Metric Card',
    type: 'metric',
    category: 'KPIs',
    icon: CardIcon,
    configSchema: {
      title: { type: 'string', label: 'Title' },
      dataSource: { type: 'select', label: 'Data Source' },
      metric: { type: 'field', label: 'Metric Field' },
      aggregation: {
        type: 'select',
        label: 'Aggregation',
        options: ['sum', 'avg', 'count', 'min', 'max']
      },
      comparison: { type: 'boolean', label: 'Show Comparison' },
      format: {
        type: 'select',
        label: 'Format',
        options: ['number', 'currency', 'percentage']
      }
    },
    defaultConfig: {
      title: 'Metric',
      aggregation: 'sum',
      format: 'number',
      comparison: false
    },
    preview: MetricCardPreview,
    render: MetricCardComponent
  },
  {
    id: 'text-block',
    name: 'Text Block',
    type: 'text',
    category: 'Content',
    icon: Type,
    configSchema: {
      content: { type: 'richtext', label: 'Content' },
      alignment: {
        type: 'select',
        label: 'Alignment',
        options: ['left', 'center', 'right']
      }
    },
    defaultConfig: {
      content: '<p>Enter your text here...</p>',
      alignment: 'left'
    },
    preview: TextBlockPreview,
    render: TextBlockComponent
  },
  {
    id: 'date-filter',
    name: 'Date Range Filter',
    type: 'filter',
    category: 'Filters',
    icon: Filter,
    configSchema: {
      label: { type: 'string', label: 'Label' },
      defaultRange: {
        type: 'select',
        label: 'Default Range',
        options: ['last7days', 'last30days', 'last90days', 'custom']
      }
    },
    defaultConfig: {
      label: 'Date Range',
      defaultRange: 'last30days'
    },
    preview: DateFilterPreview,
    render: DateFilterComponent
  }
]

// Component implementations using actual chart library
import {
  Bar,
  BarChart as RechartsBarChart,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { DataTable } from '@/components/ui/data-table'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Bar Chart Component
function BarChartComponent({ config, data }: { config: any; data: any }) {
  if (!data || !Array.isArray(data)) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RechartsBarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={config.xAxis} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={config.yAxis} fill={config.color} />
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Line Chart Component
function LineChartComponent({ config, data }: { config: any; data: any }) {
  if (!data || !Array.isArray(data)) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))']

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RechartsLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={config.xAxis} />
            <YAxis />
            <Tooltip />
            <Legend />
            {config.lines.map((line: string, index: number) => (
              <Line
                key={line}
                type="monotone"
                dataKey={line}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Pie Chart Component
function PieChartComponent({ config, data }: { config: any; data: any }) {
  if (!data || !Array.isArray(data)) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))'
  ]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label
              outerRadius={80}
              fill="#8884d8"
              dataKey={config.valueField}
              nameKey={config.labelField}
            >
              {data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </RechartsPieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Data Table Component
function DataTableComponent({ config, data }: { config: any; data: any }) {
  if (!data || !Array.isArray(data)) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Convert config columns to table columns
  const columns = config.columns.map((col: any) => ({
    accessorKey: col.field,
    header: col.label
  }))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={data}
          pageSize={config.pageSize}
        />
      </CardContent>
    </Card>
  )
}

// Metric Card Component
function MetricCardComponent({ config, data }: { config: any; data: any }) {
  const calculateValue = (data: any[], config: any) => {
    if (!data || !Array.isArray(data) || data.length === 0) return 0

    const values = data.map(row => Number(row[config.metric]) || 0)

    switch (config.aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0)
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length
      case 'count':
        return values.length
      case 'min':
        return Math.min(...values)
      case 'max':
        return Math.max(...values)
      default:
        return 0
    }
  }

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value)
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`
      default:
        return new Intl.NumberFormat('en-US').format(value)
    }
  }

  const value = calculateValue(data, config)
  const formattedValue = formatValue(value, config.format)

  // Mock comparison data
  const change = config.comparison ? Math.random() * 20 - 10 : null
  const trend = change ? (change > 0 ? 'up' : change < 0 ? 'down' : 'stable') : null

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        {config.comparison && change !== null && (
          <div className="flex items-center mt-2 text-sm">
            {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500 mr-1" />}
            {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500 mr-1" />}
            {trend === 'stable' && <Minus className="h-4 w-4 text-gray-500 mr-1" />}
            <span className={
              trend === 'up' ? 'text-green-500' :
              trend === 'down' ? 'text-red-500' :
              'text-gray-500'
            }>
              {Math.abs(change).toFixed(1)}% vs last period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Text Block Component
function TextBlockComponent({ config }: { config: any }) {
  return (
    <div 
      className={`prose prose-sm max-w-none ${
        config.alignment === 'center' ? 'text-center' :
        config.alignment === 'right' ? 'text-right' :
        'text-left'
      }`}
      dangerouslySetInnerHTML={{ __html: config.content }}
    />
  )
}

// Date Filter Component
function DateFilterComponent({ config, onChange }: { config: any; onChange: (value: any) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{config.label}:</span>
      <DateRangePicker
        defaultPreset={config.defaultRange}
        onUpdate={(values) => onChange(values)}
      />
    </div>
  )
}

// Preview components
function BarChartPreview({ config }: { config: any }) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <BarChart className="h-8 w-8 mx-auto mb-2" />
      <div className="text-sm font-medium">Bar Chart</div>
    </div>
  )
}

function LineChartPreview({ config }: { config: any }) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <LineChart className="h-8 w-8 mx-auto mb-2" />
      <div className="text-sm font-medium">Line Chart</div>
    </div>
  )
}

function PieChartPreview({ config }: { config: any }) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <PieChart className="h-8 w-8 mx-auto mb-2" />
      <div className="text-sm font-medium">Pie Chart</div>
    </div>
  )
}

function DataTablePreview({ config }: { config: any }) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <Table className="h-8 w-8 mx-auto mb-2" />
      <div className="text-sm font-medium">Data Table</div>
    </div>
  )
}

function MetricCardPreview({ config }: { config: any }) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <CardIcon className="h-8 w-8 mx-auto mb-2" />
      <div className="text-sm font-medium">Metric Card</div>
    </div>
  )
}

function TextBlockPreview({ config }: { config: any }) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <Type className="h-8 w-8 mx-auto mb-2" />
      <div className="text-sm font-medium">Text Block</div>
    </div>
  )
}

function DateFilterPreview({ config }: { config: any }) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <Filter className="h-8 w-8 mx-auto mb-2" />
      <div className="text-sm font-medium">Date Filter</div>
    </div>
  )
}