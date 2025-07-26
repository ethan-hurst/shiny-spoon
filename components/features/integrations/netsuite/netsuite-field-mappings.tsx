// PRP-013: NetSuite Field Mappings Component
'use client'

import { useState } from 'react'
import { Plus, X, ArrowRight, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { updateIntegration } from '@/app/actions/integrations'

interface FieldMapping {
  sourceField: string
  targetField: string
  entityType: 'product' | 'inventory' | 'pricing' | 'customer' | 'order'
}

interface NetSuiteFieldMappingsProps {
  integrationId: string
  mappings: Record<string, any>
}

const commonNetSuiteFields = {
  product: [
    'itemid',
    'displayname',
    'salesdescription',
    'baseprice',
    'weight',
    'weightunit',
    'custitem_dimensions',
    'category',
    'itemtype',
  ],
  inventory: [
    'quantityavailable',
    'quantityonhand',
    'quantityintransit',
    'quantityonorder',
    'reorderpoint',
    'preferredstocklevel',
    'locationname',
  ],
  pricing: [
    'pricelevelname',
    'unitprice',
    'currency',
    'quantitybreak',
    'discount',
  ],
  customer: [
    'entityid',
    'companyname',
    'email',
    'phone',
    'creditlimit',
    'balance',
    'pricelevel',
    'category',
  ],
  order: [
    'tranid',
    'trandate',
    'orderstatus',
    'total',
    'subtotal',
    'customername',
    'shipmethod',
  ],
}

const truthSourceFields = {
  product: [
    'sku',
    'name',
    'description',
    'price',
    'weight',
    'dimensions',
    'category',
    'is_active',
  ],
  inventory: [
    'quantity_available',
    'quantity_on_hand',
    'quantity_on_order',
    'reorder_point',
    'preferred_stock_level',
    'warehouse_code',
  ],
  pricing: [
    'price_tier',
    'unit_price',
    'currency_code',
    'min_quantity',
    'discount_percent',
  ],
  customer: [
    'code',
    'name',
    'email',
    'phone',
    'credit_limit',
    'balance',
    'price_level',
    'category',
  ],
  order: [
    'order_number',
    'order_date',
    'status',
    'total',
    'subtotal',
    'customer_code',
    'shipping_method',
  ],
}

export function NetSuiteFieldMappings({ integrationId, mappings }: NetSuiteFieldMappingsProps) {
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(() => {
    // Convert existing mappings to array format
    const mappingArray: FieldMapping[] = []
    Object.entries(mappings).forEach(([entityType, fields]) => {
      if (typeof fields === 'object' && fields !== null) {
        Object.entries(fields).forEach(([source, target]) => {
          mappingArray.push({
            sourceField: source,
            targetField: target as string,
            entityType: entityType as FieldMapping['entityType'],
          })
        })
      }
    })
    return mappingArray
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  function addMapping() {
    setFieldMappings([
      ...fieldMappings,
      {
        sourceField: '',
        targetField: '',
        entityType: 'product',
      },
    ])
  }

  function removeMapping(index: number) {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index))
  }

  function updateMapping(index: number, field: keyof FieldMapping, value: string) {
    const updated = [...fieldMappings]
    updated[index] = { ...updated[index], [field]: value }
    setFieldMappings(updated)
  }

  async function saveFieldMappings() {
    setIsSubmitting(true)

    try {
      // Convert array back to nested object format
      const mappingsByEntity: Record<string, Record<string, string>> = {
        product: {},
        inventory: {},
        pricing: {},
        customer: {},
        order: {},
      }

      fieldMappings.forEach(mapping => {
        if (mapping.sourceField && mapping.targetField) {
          mappingsByEntity[mapping.entityType][mapping.sourceField] = mapping.targetField
        }
      })

      // Update NetSuite config with field mappings
      const formData = new FormData()
      formData.append('id', integrationId)
      
      const config = {
        field_mappings: mappingsByEntity,
      }
      formData.append('config', JSON.stringify(config))
      
      await updateIntegration(formData)
      
      toast({
        title: 'Mappings saved',
        description: 'Field mappings have been updated successfully.',
      })
    } catch (error) {
      console.error('Failed to save field mappings:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save mappings',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Custom Field Mappings</CardTitle>
          <CardDescription>
            Map NetSuite fields to TruthSource fields for custom data transformation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {fieldMappings.map((mapping, index) => (
              <div key={index} className="flex items-end gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <Label htmlFor={`entity-${index}`}>Entity Type</Label>
                  <Select
                    value={mapping.entityType}
                    onValueChange={(value) => updateMapping(index, 'entityType', value)}
                  >
                    <SelectTrigger id={`entity-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                      <SelectItem value="pricing">Pricing</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="order">Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <Label htmlFor={`source-${index}`}>NetSuite Field</Label>
                  <Select
                    value={mapping.sourceField}
                    onValueChange={(value) => updateMapping(index, 'sourceField', value)}
                  >
                    <SelectTrigger id={`source-${index}`}>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {commonNetSuiteFields[mapping.entityType].map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom Field...</SelectItem>
                    </SelectContent>
                  </Select>
                  {mapping.sourceField === 'custom' && (
                    <Input
                      className="mt-2"
                      placeholder="e.g., custitem_my_field"
                      onChange={(e) => updateMapping(index, 'sourceField', e.target.value)}
                    />
                  )}
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground" />

                <div className="flex-1">
                  <Label htmlFor={`target-${index}`}>TruthSource Field</Label>
                  <Select
                    value={mapping.targetField}
                    onValueChange={(value) => updateMapping(index, 'targetField', value)}
                  >
                    <SelectTrigger id={`target-${index}`}>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {truthSourceFields[mapping.entityType].map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                      <SelectItem value="metadata">Metadata Field...</SelectItem>
                    </SelectContent>
                  </Select>
                  {mapping.targetField === 'metadata' && (
                    <Input
                      className="mt-2"
                      placeholder="e.g., metadata.custom_field"
                      onChange={(e) => updateMapping(index, 'targetField', e.target.value)}
                    />
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMapping(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addMapping}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Field Mapping
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Field Mappings</CardTitle>
          <CardDescription>
            These standard mappings are automatically applied
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Products</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded">itemid</code>
                  <ArrowRight className="h-3 w-3" />
                  <code className="bg-muted px-2 py-1 rounded">sku</code>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded">displayname</code>
                  <ArrowRight className="h-3 w-3" />
                  <code className="bg-muted px-2 py-1 rounded">name</code>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded">salesdescription</code>
                  <ArrowRight className="h-3 w-3" />
                  <code className="bg-muted px-2 py-1 rounded">description</code>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Inventory</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded">quantityavailable</code>
                  <ArrowRight className="h-3 w-3" />
                  <code className="bg-muted px-2 py-1 rounded">quantity_available</code>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded">quantityonhand</code>
                  <ArrowRight className="h-3 w-3" />
                  <code className="bg-muted px-2 py-1 rounded">quantity_on_hand</code>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Pricing</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded">pricelevelname</code>
                  <ArrowRight className="h-3 w-3" />
                  <code className="bg-muted px-2 py-1 rounded">price_tier</code>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded">unitprice</code>
                  <ArrowRight className="h-3 w-3" />
                  <code className="bg-muted px-2 py-1 rounded">unit_price</code>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveFieldMappings} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Field Mappings
        </Button>
      </div>
    </div>
  )
}