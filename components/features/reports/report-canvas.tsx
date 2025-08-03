'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Settings } from 'lucide-react'
import { ReportComponent } from './report-component'
import type { ReportCanvasProps } from '@/types/reports.types'

export function ReportCanvas({
  config,
  selectedComponent,
  onSelectComponent,
  onUpdateComponent,
  onDeleteComponent,
}: ReportCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
  })

  const handleComponentSelect = (componentId: string) => {
    onSelectComponent(selectedComponent === componentId ? null : componentId)
  }

  const handleComponentDelete = (componentId: string) => {
    onDeleteComponent(componentId)
    if (selectedComponent === componentId) {
      onSelectComponent(null)
    }
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div
        ref={setNodeRef}
        className={`min-h-full rounded-lg border-2 border-dashed transition-colors ${
          isOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 bg-muted/10'
        }`}
      >
        {config.components.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-center">
            <div className="space-y-4">
              <div className="text-muted-foreground">
                <Plus className="mx-auto h-12 w-12 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No components yet</h3>
                <p className="text-sm">
                  Drag components from the library to start building your report
                </p>
              </div>
            </div>
          </div>
        ) : (
          <SortableContext items={config.components.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="p-4 space-y-4">
              {config.components.map((component, index) => (
                <ReportComponent
                  key={component.id}
                  component={component}
                  index={index}
                  isSelected={selectedComponent === component.id}
                  onSelect={() => handleComponentSelect(component.id)}
                  onUpdate={(updates) => onUpdateComponent(component.id, updates)}
                  onDelete={() => handleComponentDelete(component.id)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  )
} 