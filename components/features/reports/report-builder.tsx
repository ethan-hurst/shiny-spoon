// components/features/reports/report-builder.tsx
'use client'

import { useState } from 'react'
import {
  Activity,
  BarChart3,
  Plus,
  Save,
  Table,
  Trash2,
  Type,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { ReportComponent, ReportConfig } from '@/types/reports.types'

interface ReportBuilderProps {
  initialConfig?: ReportConfig
  templateId?: string
  onSave: (config: ReportConfig) => Promise<void>
}

const componentTypes = [
  {
    id: 'chart',
    name: 'Chart',
    icon: BarChart3,
    description: 'Bar, line, or pie charts',
  },
  {
    id: 'table',
    name: 'Table',
    icon: Table,
    description: 'Data tables with sorting',
  },
  {
    id: 'metric',
    name: 'Metric',
    icon: Activity,
    description: 'KPI cards and metrics',
  },
  { id: 'text', name: 'Text', icon: Type, description: 'Rich text content' },
]

export function ReportBuilder({
  initialConfig,
  templateId,
  onSave,
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
        spacing: 'normal',
      },
    }
  )
  const [isSaving, setIsSaving] = useState(false)

  const addComponent = (type: string) => {
    const newComponent: ReportComponent = {
      id: `component-${Date.now()}`,
      type: type as any,
      config: getDefaultConfig(type),
      position: { x: 0, y: config.components.length },
      size: { width: 12, height: 4 },
    }

    setConfig((prev) => ({
      ...prev,
      components: [...prev.components, newComponent],
    }))
  }

  const removeComponent = (componentId: string) => {
    setConfig((prev) => ({
      ...prev,
      components: prev.components.filter((c) => c.id !== componentId),
    }))
  }

  const updateComponent = (
    componentId: string,
    updates: Partial<ReportComponent>
  ) => {
    setConfig((prev) => ({
      ...prev,
      components: prev.components.map((c) =>
        c.id === componentId ? { ...c, ...updates } : c
      ),
    }))
  }

  const handleSave = async () => {
    if (!config.name.trim()) {
      toast.error('Please enter a report name')
      return
    }

    setIsSaving(true)
    try {
      await onSave(config)
      toast.success('Report saved successfully')
    } catch (error) {
      toast.error('Failed to save report')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Component Library */}
      <div className="w-80 border-r bg-muted/10 p-4 overflow-y-auto">
        <h3 className="font-semibold mb-4">Components</h3>
        <div className="space-y-3">
          {componentTypes.map((type) => {
            const Icon = type.icon
            return (
              <Card
                key={type.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => addComponent(type.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <div>
                      <div className="font-medium text-sm">{type.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {type.description}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Input
              type="text"
              value={config.name}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, name: e.target.value }))
              }
              className="text-lg font-semibold w-64"
              placeholder="Report Name"
            />
          </div>

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Report
              </>
            )}
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="design" className="h-full">
            <TabsList className="mx-4 mt-4">
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="data">Data Sources</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="design" className="h-full p-4">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Click components on the left to add them to your report. You
                  can configure each component after adding it.
                </div>

                {config.components.length === 0 ? (
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <div className="text-muted-foreground">
                      <Plus className="mx-auto h-8 w-8 mb-2" />
                      <p>No components added yet</p>
                      <p className="text-sm">
                        Choose from the component library on the left
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {config.components.map((component, index) => (
                      <ComponentEditor
                        key={component.id}
                        component={component}
                        index={index}
                        onUpdate={(updates) =>
                          updateComponent(component.id, updates)
                        }
                        onRemove={() => removeComponent(component.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="data" className="p-4">
              <div className="space-y-4">
                <h3 className="font-semibold">Data Sources</h3>
                <p className="text-sm text-muted-foreground">
                  Configure data sources for your report components. This will
                  be expanded in future versions.
                </p>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center text-muted-foreground">
                      Data source configuration coming soon
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="p-4">
              <div className="space-y-4">
                <h3 className="font-semibold">Report Settings</h3>

                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={config.name}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Describe what this report shows..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={config.style.theme}
                      onValueChange={(value) =>
                        setConfig((prev) => ({
                          ...prev,
                          style: {
                            ...prev.style,
                            theme: value as 'light' | 'dark',
                          },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="spacing">Spacing</Label>
                    <Select
                      value={config.style.spacing}
                      onValueChange={(value) =>
                        setConfig((prev) => ({
                          ...prev,
                          style: {
                            ...prev.style,
                            spacing: value as
                              | 'compact'
                              | 'normal'
                              | 'comfortable',
                          },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

function ComponentEditor({
  component,
  index,
  onUpdate,
  onRemove,
}: {
  component: ReportComponent
  index: number
  onUpdate: (updates: Partial<ReportComponent>) => void
  onRemove: () => void
}) {
  const Icon =
    componentTypes.find((t) => t.id === component.type)?.icon || BarChart3

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <CardTitle className="text-base">
              {componentTypes.find((t) => t.id === component.type)?.name ||
                component.type}{' '}
              #{index + 1}
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`title-${component.id}`}>Title</Label>
          <Input
            id={`title-${component.id}`}
            value={component.config.title || ''}
            onChange={(e) =>
              onUpdate({
                config: { ...component.config, title: e.target.value },
              })
            }
            placeholder="Component title"
          />
        </div>

        {component.type === 'text' && (
          <div>
            <Label htmlFor={`content-${component.id}`}>Content</Label>
            <Textarea
              id={`content-${component.id}`}
              value={component.config.content || ''}
              onChange={(e) =>
                onUpdate({
                  config: { ...component.config, content: e.target.value },
                })
              }
              placeholder="Enter text content..."
            />
          </div>
        )}

        {(component.type === 'chart' || component.type === 'table') && (
          <div className="text-sm text-muted-foreground">
            Data source configuration will be available in the Data Sources tab.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getDefaultConfig(type: string): Record<string, any> {
  switch (type) {
    case 'chart':
      return {
        title: 'Chart',
        chartType: 'bar',
        xAxis: '',
        yAxis: '',
        color: 'hsl(var(--chart-1))',
      }
    case 'table':
      return {
        title: 'Data Table',
        columns: [],
        pageSize: 25,
      }
    case 'metric':
      return {
        title: 'Metric',
        aggregation: 'sum',
        format: 'number',
        comparison: false,
      }
    case 'text':
      return {
        content: 'Enter your text here...',
        alignment: 'left',
      }
    default:
      return {}
  }
}
