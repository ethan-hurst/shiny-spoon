'use client'

import { useDraggable } from '@dnd-kit/core'
import { Card, CardContent } from '@/components/ui/card'
import { REPORT_COMPONENTS } from '@/lib/reports/report-components'
import { cn } from '@/lib/utils'

function DraggableComponent({ component }: { component: any }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${component.id}`,
    data: {
      type: 'library-component',
      componentType: component.type,
      defaultConfig: component.defaultConfig
    }
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  const Icon = component.icon

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-move hover:bg-accent transition-colors",
        isDragging && "opacity-50"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">{component.name}</div>
            <div className="text-xs text-muted-foreground">
              {component.category}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ComponentLibrary() {
  // Group components by category
  const componentsByCategory = REPORT_COMPONENTS.reduce((acc, component) => {
    if (!acc[component.category]) {
      acc[component.category] = []
    }
    acc[component.category].push(component)
    return acc
  }, {} as Record<string, typeof REPORT_COMPONENTS>)

  return (
    <div className="space-y-6">
      {Object.entries(componentsByCategory).map(([category, components]) => (
        <div key={category}>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {category}
          </h4>
          <div className="space-y-2">
            {components.map((component) => (
              <DraggableComponent key={component.id} component={component} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}