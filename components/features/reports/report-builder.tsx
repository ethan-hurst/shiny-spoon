// components/features/reports/report-builder.tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ComponentLibrary } from './component-library'
import { ReportCanvas } from './report-canvas'
import { ReportSettings } from './report-settings'
import { ReportPreview } from './report-preview'
import { DataSourceManager } from './data-source-manager'
import { ComponentProperties } from './component-properties'
import { Save, Play, Settings, Eye } from 'lucide-react'
import type { ReportConfig, ReportComponent } from '@/types/reports.types'

interface ReportBuilderProps {
  initialConfig?: ReportConfig
  templateId?: string
  onSave: (config: ReportConfig) => Promise<void>
}

export function ReportBuilder({
  initialConfig,
  templateId,
  onSave
}: ReportBuilderProps) {
  const [config, setConfig] = useState<ReportConfig>(
    initialConfig || {
      name: 'Untitled Report',
      layout: 'grid',
      components: [],
      dataSources: [],
      filters: [],
      style: {
        theme: 'light',
        spacing: 'normal'
      }
    }
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    // Handle dropping from library to canvas
    if (active.data.current?.type === 'library-component' && over.id === 'canvas') {
      const newComponent: ReportComponent = {
        id: `component-${Date.now()}`,
        type: active.data.current.componentType,
        config: active.data.current.defaultConfig,
        position: { x: 0, y: config.components.length },
        size: { width: 12, height: 4 }
      }

      setConfig(prev => ({
        ...prev,
        components: [...prev.components, newComponent]
      }))
    }
    // Handle reordering within canvas
    else if (active.id !== over.id) {
      setConfig(prev => {
        const oldIndex = prev.components.findIndex(c => c.id === active.id)
        const newIndex = prev.components.findIndex(c => c.id === over.id)

        return {
          ...prev,
          components: arrayMove(prev.components, oldIndex, newIndex)
        }
      })
    }

    setActiveId(null)
  }

  const handleComponentUpdate = (componentId: string, updates: Partial<ReportComponent>) => {
    setConfig(prev => ({
      ...prev,
      components: prev.components.map(c =>
        c.id === componentId ? { ...c, ...updates } : c
      )
    }))
  }

  const handleComponentDelete = (componentId: string) => {
    setConfig(prev => ({
      ...prev,
      components: prev.components.filter(c => c.id !== componentId)
    }))
    if (selectedComponent === componentId) {
      setSelectedComponent(null)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(config)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Left Sidebar - Component Library */}
        <div className="w-80 border-r bg-muted/10 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Components</h3>
          <ComponentLibrary />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="border-b p-4 flex items-center justify-between">
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
              className="text-xl font-semibold bg-transparent border-none outline-none"
              placeholder="Report Name"
            />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {previewMode ? 'Edit' : 'Preview'}
              </Button>

              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Report
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {previewMode ? (
              <ReportPreview config={config} />
            ) : (
              <Tabs defaultValue="design" className="h-full">
                <TabsList className="mx-4 mt-4">
                  <TabsTrigger value="design">Design</TabsTrigger>
                  <TabsTrigger value="data">Data Sources</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="design" className="h-full p-4">
                  <ReportCanvas
                    config={config}
                    selectedComponent={selectedComponent}
                    onSelectComponent={setSelectedComponent}
                    onUpdateComponent={handleComponentUpdate}
                    onDeleteComponent={handleComponentDelete}
                  />
                </TabsContent>

                <TabsContent value="data" className="p-4">
                  <DataSourceManager
                    dataSources={config.dataSources}
                    onChange={(dataSources) =>
                      setConfig(prev => ({ ...prev, dataSources }))
                    }
                  />
                </TabsContent>

                <TabsContent value="settings" className="p-4">
                  <ReportSettings
                    config={config}
                    onChange={setConfig}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>

        {/* Right Sidebar - Properties Panel */}
        {selectedComponent && !previewMode && (
          <div className="w-80 border-l bg-muted/10 p-4">
            <ComponentProperties
              component={config.components.find(c => c.id === selectedComponent)}
              onChange={(updates) => handleComponentUpdate(selectedComponent, updates)}
            />
          </div>
        )}

        <DragOverlay>
          {activeId ? <div className="opacity-50">Dragging component...</div> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}