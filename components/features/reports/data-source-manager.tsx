'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Database, Trash2 } from 'lucide-react'
import type { DataSource } from '@/types/reports.types'

interface DataSourceManagerProps {
  dataSources: DataSource[]
  onChange: (dataSources: DataSource[]) => void
}

export function DataSourceManager({ dataSources, onChange }: DataSourceManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const addDataSource = () => {
    const newDataSource: DataSource = {
      id: `ds-${Date.now()}`,
      type: 'query',
      query: ''
    }
    onChange([...dataSources, newDataSource])
    setEditingId(newDataSource.id)
  }

  const updateDataSource = (id: string, updates: Partial<DataSource>) => {
    onChange(dataSources.map(ds => 
      ds.id === id ? { ...ds, ...updates } : ds
    ))
  }

  const deleteDataSource = (id: string) => {
    onChange(dataSources.filter(ds => ds.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Data Sources</h3>
          <p className="text-sm text-muted-foreground">
            Configure data sources for your report components
          </p>
        </div>
        <Button onClick={addDataSource} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Data Source
        </Button>
      </div>

      {dataSources.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No data sources configured</p>
              <p className="text-sm mt-2">
                Add a data source to start querying your data
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dataSources.map((dataSource) => (
            <Card key={dataSource.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {dataSource.id}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteDataSource(dataSource.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Data Source ID</Label>
                  <Input
                    value={dataSource.id}
                    onChange={(e) => updateDataSource(dataSource.id, { id: e.target.value })}
                    placeholder="unique-id"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used to reference this data source in components
                  </p>
                </div>

                <div>
                  <Label>Type</Label>
                  <Select
                    value={dataSource.type}
                    onValueChange={(value: 'query' | 'analytics') => 
                      updateDataSource(dataSource.id, { type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="query">SQL Query</SelectItem>
                      <SelectItem value="analytics">Analytics Metric</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dataSource.type === 'query' && (
                  <div>
                    <Label>SQL Query</Label>
                    <Textarea
                      value={dataSource.query || ''}
                      onChange={(e) => updateDataSource(dataSource.id, { query: e.target.value })}
                      placeholder="SELECT * FROM inventory WHERE organization_id = :orgId"
                      rows={4}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use :orgId as a parameter for the organization ID
                    </p>
                  </div>
                )}

                {dataSource.type === 'analytics' && (
                  <div>
                    <Label>Metric</Label>
                    <Select
                      value={dataSource.metric || ''}
                      onValueChange={(value) => updateDataSource(dataSource.id, { metric: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select metric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inventory_value">Inventory Value</SelectItem>
                        <SelectItem value="order_accuracy">Order Accuracy</SelectItem>
                        <SelectItem value="sync_performance">Sync Performance</SelectItem>
                        <SelectItem value="customer_metrics">Customer Metrics</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Limit (optional)</Label>
                  <Input
                    type="number"
                    value={dataSource.limit || ''}
                    onChange={(e) => updateDataSource(dataSource.id, { 
                      limit: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    placeholder="100"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}