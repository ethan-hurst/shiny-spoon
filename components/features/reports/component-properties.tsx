'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Settings, Palette, Type, BarChart3 } from 'lucide-react'
import type { ComponentPropertiesProps } from '@/types/reports.types'

export function ComponentProperties({ component, onChange }: ComponentPropertiesProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'data' | 'style'>('general')

  if (!component) {
    return (
      <div className="text-center text-muted-foreground p-4">
        <Settings className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">Select a component to edit its properties</p>
      </div>
    )
  }

  const updateConfig = (updates: Record<string, any>) => {
    onChange({
      config: {
        ...component.config,
        ...updates,
      },
    })
  }

  const renderGeneralProperties = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={component.config.title || ''}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="Component title"
          />
        </div>

        {component.type === 'text' && (
          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={component.config.content || ''}
              onChange={(e) => updateConfig({ content: e.target.value })}
              placeholder="Enter text content..."
              rows={4}
            />
          </div>
        )}

        {component.type === 'chart' && (
          <>
            <div>
              <Label htmlFor="chartType">Chart Type</Label>
              <Select
                value={component.config.chartType || 'bar'}
                onValueChange={(value) => updateConfig({ chartType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="xAxis">X Axis Field</Label>
              <Input
                id="xAxis"
                value={component.config.xAxis || ''}
                onChange={(e) => updateConfig({ xAxis: e.target.value })}
                placeholder="e.g., date, category"
              />
            </div>

            <div>
              <Label htmlFor="yAxis">Y Axis Field</Label>
              <Input
                id="yAxis"
                value={component.config.yAxis || ''}
                onChange={(e) => updateConfig({ yAxis: e.target.value })}
                placeholder="e.g., value, count"
              />
            </div>
          </>
        )}

        {component.type === 'table' && (
          <>
            <div>
              <Label htmlFor="pageSize">Page Size</Label>
              <Select
                value={String(component.config.pageSize || 25)}
                onValueChange={(value) => updateConfig({ pageSize: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="sortable"
                checked={component.config.sortable !== false}
                onCheckedChange={(checked) => updateConfig({ sortable: checked })}
              />
              <Label htmlFor="sortable">Sortable</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="filterable"
                checked={component.config.filterable !== false}
                onCheckedChange={(checked) => updateConfig({ filterable: checked })}
              />
              <Label htmlFor="filterable">Filterable</Label>
            </div>
          </>
        )}

        {component.type === 'metric' && (
          <>
            <div>
              <Label htmlFor="aggregation">Aggregation</Label>
              <Select
                value={component.config.aggregation || 'sum'}
                onValueChange={(value) => updateConfig({ aggregation: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="avg">Average</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="min">Minimum</SelectItem>
                  <SelectItem value="max">Maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="format">Format</Label>
              <Select
                value={component.config.format || 'number'}
                onValueChange={(value) => updateConfig({ format: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="comparison"
                checked={component.config.comparison || false}
                onCheckedChange={(checked) => updateConfig({ comparison: checked })}
              />
              <Label htmlFor="comparison">Show Comparison</Label>
            </div>
          </>
        )}

        {component.type === 'filter' && (
          <>
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={component.config.label || ''}
                onChange={(e) => updateConfig({ label: e.target.value })}
                placeholder="Filter label"
              />
            </div>

            <div>
              <Label htmlFor="defaultRange">Default Range</Label>
              <Select
                value={component.config.defaultRange || 'last30days'}
                onValueChange={(value) => updateConfig({ defaultRange: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7days">Last 7 days</SelectItem>
                  <SelectItem value="last30days">Last 30 days</SelectItem>
                  <SelectItem value="last90days">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderDataProperties = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="dataSource">Data Source</Label>
          <Select
            value={component.config.dataSource || ''}
            onValueChange={(value) => updateConfig({ dataSource: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select data source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="orders">Orders</SelectItem>
              <SelectItem value="customers">Customers</SelectItem>
              <SelectItem value="products">Products</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {component.type === 'chart' && (
          <>
            <div>
              <Label htmlFor="dataField">Data Field</Label>
              <Input
                id="dataField"
                value={component.config.dataField || ''}
                onChange={(e) => updateConfig({ dataField: e.target.value })}
                placeholder="Field to display"
              />
            </div>

            <div>
              <Label htmlFor="groupBy">Group By</Label>
              <Input
                id="groupBy"
                value={component.config.groupBy || ''}
                onChange={(e) => updateConfig({ groupBy: e.target.value })}
                placeholder="Group by field"
              />
            </div>
          </>
        )}

        {component.type === 'metric' && (
          <div>
            <Label htmlFor="metricField">Metric Field</Label>
            <Input
              id="metricField"
              value={component.config.metricField || ''}
              onChange={(e) => updateConfig({ metricField: e.target.value })}
              placeholder="Field to calculate"
            />
          </div>
        )}
      </div>
    )
  }

  const renderStyleProperties = () => {
    return (
      <div className="space-y-4">
        {component.type === 'text' && (
          <div>
            <Label htmlFor="alignment">Alignment</Label>
            <Select
              value={component.config.alignment || 'left'}
              onValueChange={(value) => updateConfig({ alignment: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {component.type === 'chart' && (
          <div>
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              type="color"
              value={component.config.color || '#3b82f6'}
              onChange={(e) => updateConfig({ color: e.target.value })}
            />
          </div>
        )}

        <div>
          <Label htmlFor="height">Height</Label>
          <Select
            value={String(component.size?.height || 4)}
            onValueChange={(value) =>
              onChange({
                size: {
                  ...component.size,
                  height: parseInt(value),
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Small</SelectItem>
              <SelectItem value="4">Medium</SelectItem>
              <SelectItem value="6">Large</SelectItem>
              <SelectItem value="8">Extra Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="width">Width</Label>
          <Select
            value={String(component.size?.width || 12)}
            onValueChange={(value) =>
              onChange({
                size: {
                  ...component.size,
                  width: parseInt(value),
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Quarter</SelectItem>
              <SelectItem value="6">Half</SelectItem>
              <SelectItem value="9">Three Quarters</SelectItem>
              <SelectItem value="12">Full Width</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{component.type}</Badge>
        <span className="text-sm font-medium">Properties</span>
      </div>

      <div className="flex space-x-1">
        <Button
          variant={activeTab === 'general' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('general')}
        >
          <Settings className="h-3 w-3 mr-1" />
          General
        </Button>
        <Button
          variant={activeTab === 'data' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('data')}
        >
          <BarChart3 className="h-3 w-3 mr-1" />
          Data
        </Button>
        <Button
          variant={activeTab === 'style' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('style')}
        >
          <Palette className="h-3 w-3 mr-1" />
          Style
        </Button>
      </div>

      <Separator />

      <div className="space-y-4">
        {activeTab === 'general' && renderGeneralProperties()}
        {activeTab === 'data' && renderDataProperties()}
        {activeTab === 'style' && renderStyleProperties()}
      </div>
    </div>
  )
} 