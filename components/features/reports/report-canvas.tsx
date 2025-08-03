'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Settings } from 'lucide-react'
import { REPORT_COMPONENTS } from '@/lib/reports/report-components'
import { cn } from '@/lib/utils'
import type { ReportConfig, ReportComponent } from '@/types/reports.types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ReportCanvasProps {
  config: ReportConfig
  selectedComponent: string | null
  onSelectComponent: (id: string | null) => void
  onUpdateComponent: (id: string, updates: Partial<ReportComponent>) => void
  onDeleteComponent: (id: string) => void
}

function SortableComponent({
  component,
  isSelected,
  onSelect,
  onDelete
}: {
  component: ReportComponent
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const componentDef = REPORT_COMPONENTS.find(c => c.type === component.type)
  if (!componentDef) return null

  const Icon = componentDef.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative group",
        isDragging && "opacity-50"
      )}
    >
      <Card
        className={cn(
          "cursor-move transition-all",
          isSelected && "ring-2 ring-primary"
        )}
        onClick={onSelect}
      >
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{componentDef.name}</span>
          </div>
          
          {/* Component Preview */}
          <div className="h-32 flex items-center justify-center border rounded bg-muted/20">
            <componentDef.preview config={component.config} />
          </div>
        </div>
      </Card>
    </div>
  )
}

export function ReportCanvas({
  config,
  selectedComponent,
  onSelectComponent,
  onUpdateComponent,
  onDeleteComponent
}: ReportCanvasProps) {
  const { setNodeRef } = useDroppable({
    id: 'canvas',
  })

  return (
    <div
      ref={setNodeRef}
      className="h-full bg-muted/5 rounded-lg p-6 overflow-y-auto"
    >
      {config.components.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium mb-2">Start building your report</h3>
            <p className="text-muted-foreground">
              Drag components from the left sidebar and drop them here
            </p>
          </div>
        </div>
      ) : (
        <SortableContext
          items={config.components.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {config.components.map((component) => (
              <SortableComponent
                key={component.id}
                component={component}
                isSelected={component.id === selectedComponent}
                onSelect={() => onSelectComponent(component.id)}
                onDelete={() => onDeleteComponent(component.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  )
}