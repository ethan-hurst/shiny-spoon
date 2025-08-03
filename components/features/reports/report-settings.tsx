'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Settings, Palette, Layout } from 'lucide-react'
import type { ReportSettingsProps } from '@/types/reports.types'

export function ReportSettings({ config, onChange }: ReportSettingsProps) {
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({ ...config, ...updates })
  }

  const updateStyle = (updates: Partial<typeof config.style>) => {
    onChange({
      ...config,
      style: { ...config.style, ...updates },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Report Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure the overall appearance and behavior of your report.
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="report-name">Report Name</Label>
            <Input
              id="report-name"
              value={config.name}
              onChange={(e) => updateConfig({ name: e.target.value })}
              placeholder="Enter report name"
            />
          </div>

          <div>
            <Label htmlFor="report-description">Description</Label>
            <Textarea
              id="report-description"
              value={config.description || ''}
              onChange={(e) => updateConfig({ description: e.target.value })}
              placeholder="Describe what this report shows..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="report-layout">Layout</Label>
            <Select
              value={config.layout}
              onValueChange={(value) => updateConfig({ layout: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid Layout</SelectItem>
                <SelectItem value="flexible">Flexible Layout</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Style Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Style Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="report-theme">Theme</Label>
            <Select
              value={config.style.theme}
              onValueChange={(value) => updateStyle({ theme: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light Theme</SelectItem>
                <SelectItem value="dark">Dark Theme</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="report-spacing">Spacing</Label>
            <Select
              value={config.style.spacing}
              onValueChange={(value) => updateStyle({ spacing: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="loose">Loose</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Export Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Export Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="page-size">Page Size</Label>
            <Select
              value="a4"
              onValueChange={(value) => {
                // Handle page size change
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4</SelectItem>
                <SelectItem value="letter">Letter</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="orientation">Orientation</Label>
            <Select
              value="portrait"
              onValueChange={(value) => {
                // Handle orientation change
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="margins">Margins</Label>
            <Select
              value="normal"
              onValueChange={(value) => {
                // Handle margins change
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="narrow">Narrow</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanced Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="refresh-interval">Auto-refresh Interval (minutes)</Label>
            <Input
              id="refresh-interval"
              type="number"
              min="0"
              max="1440"
              placeholder="0 (disabled)"
            />
          </div>

          <div>
            <Label htmlFor="max-records">Maximum Records</Label>
            <Input
              id="max-records"
              type="number"
              min="1"
              max="10000"
              placeholder="1000"
            />
          </div>

          <div>
            <Label htmlFor="timeout">Query Timeout (seconds)</Label>
            <Input
              id="timeout"
              type="number"
              min="1"
              max="300"
              placeholder="30"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 