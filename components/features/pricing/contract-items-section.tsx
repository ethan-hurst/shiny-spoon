'use client'

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface ContractItemForm {
  product_id: string
  contract_price: number
  min_quantity: number
  max_quantity?: number
  price_locked: boolean
  notes?: string
}

interface Product {
  id: string
  sku: string
  name: string
  base_price: number
}

type ContractItemFieldValue<K extends keyof ContractItemForm> =
  ContractItemForm[K]

interface ContractItemsSectionProps {
  contractItems: ContractItemForm[]
  products: Product[]
  onAddItem: () => void
  onRemoveItem: (index: number) => void
  onUpdateItem: <K extends keyof ContractItemForm>(
    index: number,
    field: K,
    value: ContractItemFieldValue<K>
  ) => void
}

/**
 * Renders a section for managing a list of contract items, allowing users to add, edit, and remove items with associated product and pricing details.
 *
 * Displays contract items with fields for product selection, contract price, quantity limits, price lock, and notes. Provides controls to add new items or remove existing ones, and invokes callback handlers for all item modifications.
 */
export function ContractItemsSection({
  contractItems,
  products,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
}: ContractItemsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Contract Items</h4>
        <Button type="button" variant="outline" size="sm" onClick={onAddItem}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {contractItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No contract items added yet. Click "Add Item" to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {contractItems.map((item, index) => {
            const selectedProduct = products.find(
              (p) => p.id === item.product_id
            )

            return (
              <div
                key={index}
                className="space-y-4 p-4 border rounded-lg relative"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2"
                  onClick={() => onRemoveItem(index)}
                  aria-label="Remove item"
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Select
                      value={item.product_id}
                      onValueChange={(value) =>
                        onUpdateItem(index, 'product_id', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.sku} - {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Contract Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-8"
                        value={item.contract_price}
                        onChange={(e) => {
                          const value = e.target.value
                          const numValue = parseFloat(value)

                          // Validate the input
                          if (
                            value === '' ||
                            (!isNaN(numValue) && numValue >= 0)
                          ) {
                            onUpdateItem(
                              index,
                              'contract_price',
                              value === '' ? 0 : numValue
                            )
                          }
                        }}
                      />
                    </div>
                    {selectedProduct && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Base price: ${selectedProduct.base_price.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Min Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.min_quantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10)
                        const validatedValue =
                          isNaN(value) || value < 1 ? 1 : value
                        onUpdateItem(index, 'min_quantity', validatedValue)
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Quantity</Label>
                    <Input
                      type="number"
                      min={item.min_quantity}
                      value={item.max_quantity || ''}
                      onChange={(e) =>
                        onUpdateItem(
                          index,
                          'max_quantity',
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      placeholder="No limit"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Price Lock</Label>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        checked={item.price_locked}
                        onCheckedChange={(checked) =>
                          onUpdateItem(index, 'price_locked', checked)
                        }
                      />
                      <Label className="text-sm font-normal">Lock price</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={item.notes || ''}
                    onChange={(e) =>
                      onUpdateItem(index, 'notes', e.target.value)
                    }
                    placeholder="Additional notes for this item..."
                    rows={2}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
