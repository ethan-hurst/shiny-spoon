'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReportConfig } from '@/types/reports.types'

interface ReportSettingsProps {
  config: ReportConfig
  onChange: (config: ReportConfig) => void
}

export function ReportSettings({ config, onChange }: ReportSettingsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Report Name</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => onChange({ ...config, name: e.target.value })}
              placeholder="Enter report name"
            />
          </div>

          <div>
            <Label htmlFor="layout">Layout</Label>
            <Select
              value={config.layout}
              onValueChange={(value: 'grid' | 'flex') => 
                onChange({ ...config, layout: value })
              }
            >
              <SelectTrigger id="layout">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid Layout</SelectItem>
                <SelectItem value="flex">Flexible Layout</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Grid layout arranges components in a structured grid, while flexible layout allows free positioning
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={config.style.theme}
              onValueChange={(value: 'light' | 'dark') => 
                onChange({
                  ...config,
                  style: { ...config.style, theme: value }
                })
              }
            >
              <SelectTrigger id="theme">
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
              onValueChange={(value: 'compact' | 'normal' | 'relaxed') => 
                onChange({
                  ...config,
                  style: { ...config.style, spacing: value }
                })
              }
            >
              <SelectTrigger id="spacing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="relaxed">Relaxed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Global filters can be configured here and will apply to all components in the report.
            This feature will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}