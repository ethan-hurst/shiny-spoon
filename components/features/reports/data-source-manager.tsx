'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Database, BarChart3 } from 'lucide-react'
import type { DataSourceManagerProps, DataSource } from '@/types/reports.types'

export function DataSourceManager({ dataSources, onChange }: DataSourceManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newDataSource, setNewDataSource] = useState<Partial<DataSource>>({
    type: 'query',
  })

  const handleAddDataSource = () => {
    if (!newDataSource.id || !newDataSource.type) return

    const dataSource: DataSource = {
      id: newDataSource.id,
      type: newDataSource.type,
      query: newDataSource.query,
      metric: newDataSource.metric,
      limit: newDataSource.limit,
    }

    onChange([...dataSources, dataSource])
    setNewDataSource({ type: 'query' })
  }

  const handleUpdateDataSource = (id: string, updates: Partial<DataSource>) => {
    onChange(
      dataSources.map((ds) => (ds.id === id ? { ...ds, ...updates } : ds))
    )
  }

  const handleDeleteDataSource = (id: string) => {
    onChange(dataSources.filter((ds) => ds.id !== id))
  }

  const getDataSourceIcon = (type: string) => {
    switch (type) {
      case 'query':
        return Database
      case 'analytics':
        return BarChart3
      default:
        return Database
    }
  }

  const getDataSourceLabel = (type: string) => {
    switch (type) {
      case 'query':
        return 'SQL Query'
      case 'analytics':
        return 'Analytics'
      default:
        return 'Data Source'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Data Sources</h3>
        <p className="text-sm text-muted-foreground">
          Configure data sources for your report components. Each component can reference
          a data source to display data.
        </p>
      </div>

      {/* Existing Data Sources */}
      <div className="space-y-4">
        {dataSources.map((dataSource) => (
          <Card key={dataSource.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {React.createElement(getDataSourceIcon(dataSource.type), {
                    className: 'h-4 w-4',
                  })}
                  <CardTitle className="text-base">{dataSource.id}</CardTitle>
                  <Badge variant="secondary">
                    {getDataSourceLabel(dataSource.type)}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDataSource(dataSource.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dataSource.type === 'query' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor={`query-${dataSource.id}`}>SQL Query</Label>
                    <Textarea
                      id={`query-${dataSource.id}`}
                      value={dataSource.query || ''}
                      onChange={(e) =>
                        handleUpdateDataSource(dataSource.id, { query: e.target.value })
                      }
                      placeholder="SELECT * FROM table WHERE organization_id = :orgId"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`limit-${dataSource.id}`}>Limit</Label>
                    <Input
                      id={`limit-${dataSource.id}`}
                      type="number"
                      value={dataSource.limit || ''}
                      onChange={(e) =>
                        handleUpdateDataSource(dataSource.id, {
                          limit: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="100"
                    />
                  </div>
                </div>
              )}

              {dataSource.type === 'analytics' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor={`metric-${dataSource.id}`}>Analytics Metric</Label>
                    <Select
                      value={dataSource.metric || ''}
                      onValueChange={(value) =>
                        handleUpdateDataSource(dataSource.id, { metric: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select metric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order_accuracy">Order Accuracy</SelectItem>
                        <SelectItem value="inventory_trends">Inventory Trends</SelectItem>
                        <SelectItem value="revenue_impact">Revenue Impact</SelectItem>
                        <SelectItem value="sync_performance">Sync Performance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`limit-${dataSource.id}`}>Limit</Label>
                    <Input
                      id={`limit-${dataSource.id}`}
                      type="number"
                      value={dataSource.limit || ''}
                      onChange={(e) =>
                        handleUpdateDataSource(dataSource.id, {
                          limit: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="100"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Data Source */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Data Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-datasource-id">ID</Label>
                <Input
                  id="new-datasource-id"
                  value={newDataSource.id || ''}
                  onChange={(e) =>
                    setNewDataSource({ ...newDataSource, id: e.target.value })
                  }
                  placeholder="e.g., inventory_data"
                />
              </div>
              <div>
                <Label htmlFor="new-datasource-type">Type</Label>
                <Select
                  value={newDataSource.type || 'query'}
                  onValueChange={(value) =>
                    setNewDataSource({ ...newDataSource, type: value as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="query">SQL Query</SelectItem>
                    <SelectItem value="analytics">Analytics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newDataSource.type === 'query' && (
              <div>
                <Label htmlFor="new-datasource-query">SQL Query</Label>
                <Textarea
                  id="new-datasource-query"
                  value={newDataSource.query || ''}
                  onChange={(e) =>
                    setNewDataSource({ ...newDataSource, query: e.target.value })
                  }
                  placeholder="SELECT * FROM table WHERE organization_id = :orgId"
                  rows={3}
                />
              </div>
            )}

            {newDataSource.type === 'analytics' && (
              <div>
                <Label htmlFor="new-datasource-metric">Analytics Metric</Label>
                <Select
                  value={newDataSource.metric || ''}
                  onValueChange={(value) =>
                    setNewDataSource({ ...newDataSource, metric: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select metric" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order_accuracy">Order Accuracy</SelectItem>
                    <SelectItem value="inventory_trends">Inventory Trends</SelectItem>
                    <SelectItem value="revenue_impact">Revenue Impact</SelectItem>
                    <SelectItem value="sync_performance">Sync Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="new-datasource-limit">Limit (optional)</Label>
              <Input
                id="new-datasource-limit"
                type="number"
                value={newDataSource.limit || ''}
                onChange={(e) =>
                  setNewDataSource({
                    ...newDataSource,
                    limit: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="100"
              />
            </div>

            <Button onClick={handleAddDataSource} disabled={!newDataSource.id}>
              <Plus className="h-4 w-4 mr-2" />
              Add Data Source
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 