'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { REPORT_COMPONENTS } from '@/lib/reports/report-components'
import type { ReportComponent } from '@/types/reports.types'

interface ComponentPropertiesProps {
  component?: ReportComponent
  onChange: (updates: Partial<ReportComponent>) => void
}

export function ComponentProperties({ component, onChange }: ComponentPropertiesProps) {
  if (!component) return null

  const componentDef = REPORT_COMPONENTS.find(c => c.type === component.type)
  if (!componentDef) return null

  const updateConfig = (key: string, value: any) => {
    onChange({
      config: {
        ...component.config,
        [key]: value
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg mb-1">{componentDef.name}</h3>
        <p className="text-sm text-muted-foreground">Configure component properties</p>
      </div>

      <div className="space-y-4">
        {Object.entries(componentDef.configSchema).map(([key, schema]: [string, any]) => {
          const value = component.config[key]

          switch (schema.type) {
            case 'string':
              return (
                <div key={key}>
                  <Label htmlFor={key}>{schema.label}</Label>
                  <Input
                    id={key}
                    value={value || ''}
                    onChange={(e) => updateConfig(key, e.target.value)}
                    placeholder={`Enter ${schema.label.toLowerCase()}`}
                  />
                </div>
              )

            case 'number':
              return (
                <div key={key}>
                  <Label htmlFor={key}>{schema.label}</Label>
                  <Input
                    id={key}
                    type="number"
                    value={value || ''}
                    onChange={(e) => updateConfig(key, parseInt(e.target.value))}
                    min={schema.min}
                    max={schema.max}
                  />
                </div>
              )

            case 'select':
              return (
                <div key={key}>
                  <Label htmlFor={key}>{schema.label}</Label>
                  <Select value={value} onValueChange={(v) => updateConfig(key, v)}>
                    <SelectTrigger id={key}>
                      <SelectValue placeholder={`Select ${schema.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {schema.options.map((option: string) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )

            case 'boolean':
              return (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key}>{schema.label}</Label>
                  <Switch
                    id={key}
                    checked={value || false}
                    onCheckedChange={(checked) => updateConfig(key, checked)}
                  />
                </div>
              )

            case 'richtext':
              return (
                <div key={key}>
                  <Label htmlFor={key}>{schema.label}</Label>
                  <Textarea
                    id={key}
                    value={value || ''}
                    onChange={(e) => updateConfig(key, e.target.value)}
                    placeholder={`Enter ${schema.label.toLowerCase()}`}
                    rows={4}
                  />
                </div>
              )

            case 'color':
              return (
                <div key={key}>
                  <Label htmlFor={key}>{schema.label}</Label>
                  <Input
                    id={key}
                    type="color"
                    value={value || '#000000'}
                    onChange={(e) => updateConfig(key, e.target.value)}
                    className="h-10"
                  />
                </div>
              )

            case 'field':
              return (
                <div key={key}>
                  <Label htmlFor={key}>{schema.label}</Label>
                  <Input
                    id={key}
                    value={value || ''}
                    onChange={(e) => updateConfig(key, e.target.value)}
                    placeholder="Field name"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the field name from your data source
                  </p>
                </div>
              )

            case 'multi-field':
              return (
                <div key={key}>
                  <Label>{schema.label}</Label>
                  <div className="space-y-2">
                    {(value || []).map((field: string, index: number) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={field}
                          onChange={(e) => {
                            const newFields = [...(value || [])]
                            newFields[index] = e.target.value
                            updateConfig(key, newFields)
                          }}
                          placeholder="Field name"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newFields = (value || []).filter((_: any, i: number) => i !== index)
                            updateConfig(key, newFields)
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateConfig(key, [...(value || []), ''])}
                    >
                      Add Field
                    </Button>
                  </div>
                </div>
              )

            case 'columns':
              return (
                <div key={key}>
                  <Label>{schema.label}</Label>
                  <div className="space-y-2">
                    {(value || []).map((col: any, index: number) => (
                      <div key={index} className="space-y-2 p-2 border rounded">
                        <Input
                          value={col.field || ''}
                          onChange={(e) => {
                            const newCols = [...(value || [])]
                            newCols[index] = { ...col, field: e.target.value }
                            updateConfig(key, newCols)
                          }}
                          placeholder="Field name"
                        />
                        <Input
                          value={col.label || ''}
                          onChange={(e) => {
                            const newCols = [...(value || [])]
                            newCols[index] = { ...col, label: e.target.value }
                            updateConfig(key, newCols)
                          }}
                          placeholder="Column label"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newCols = (value || []).filter((_: any, i: number) => i !== index)
                            updateConfig(key, newCols)
                          }}
                        >
                          Remove Column
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateConfig(key, [...(value || []), { field: '', label: '' }])}
                    >
                      Add Column
                    </Button>
                  </div>
                </div>
              )

            default:
              return null
          }
        })}
      </div>
    </div>
  )
}

import { Button } from '@/components/ui/button'