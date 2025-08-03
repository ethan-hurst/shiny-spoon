'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  GripVertical,
  Trash2,
  Settings,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ReportComponent as ReportComponentType } from '@/types/reports.types'

interface ReportComponentProps {
  component: ReportComponentType
  index: number
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<ReportComponentType>) => void
  onDelete: () => void
}

const COMPONENT_ICONS = {
  chart: BarChart,
  table: Table,
  metric: CardIcon,
  text: Type,
  image: Image,
  filter: Filter,
}

const COMPONENT_LABELS = {
  chart: 'Chart',
  table: 'Table',
  metric: 'Metric',
  text: 'Text',
  image: 'Image',
  filter: 'Filter',
}

export function ReportComponent({
  component,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: ReportComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id })

  const Icon = COMPONENT_ICONS[component.type] || BarChart
  const label = COMPONENT_LABELS[component.type]

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const renderPreview = () => {
    switch (component.type) {
      case 'chart':
        return (
          <div className="h-32 bg-muted/20 rounded flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <BarChart className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">{component.config.title || 'Chart'}</p>
            </div>
          </div>
        )
      case 'table':
        return (
          <div className="h-32 bg-muted/20 rounded flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Table className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">{component.config.title || 'Data Table'}</p>
            </div>
          </div>
        )
      case 'metric':
        return (
          <div className="h-32 bg-muted/20 rounded flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <CardIcon className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">{component.config.title || 'Metric'}</p>
            </div>
          </div>
        )
      case 'text':
        return (
          <div className="h-32 bg-muted/20 rounded p-4">
            <div
              className="text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: component.config.content || '<p>Text content...</p>',
              }}
            />
          </div>
        )
      case 'image':
        return (
          <div className="h-32 bg-muted/20 rounded flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Image className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">{component.config.alt || 'Image'}</p>
            </div>
          </div>
        )
      case 'filter':
        return (
          <div className="h-32 bg-muted/20 rounded flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Filter className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">{component.config.label || 'Filter'}</p>
            </div>
          </div>
        )
      default:
        return (
          <div className="h-32 bg-muted/20 rounded flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">Component</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'opacity-50' : ''}`}
    >
      <Card
        className={`cursor-pointer transition-all ${
          isSelected
            ? 'ring-2 ring-primary border-primary'
            : 'hover:border-muted-foreground/50'
        }`}
        onClick={onSelect}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {label} #{index + 1}
              </span>
              <Badge variant="secondary" className="text-xs">
                {component.type}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect()
                }}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {renderPreview()}
        </CardContent>
      </Card>
    </div>
  )
} 