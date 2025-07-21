'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { QuantityBreak } from '@/types/pricing.types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { validateQuantityBreaks } from '@/lib/pricing/validations'

interface QuantityBreaksEditorProps {
  breaks: QuantityBreak[]
  onChange: (breaks: QuantityBreak[]) => void
}

export function QuantityBreaksEditor({ breaks, onChange }: QuantityBreaksEditorProps) {
  const [errors, setErrors] = useState<string[]>([])

  const addBreak = () => {
    const newBreak: QuantityBreak = {
      min_quantity: breaks.length > 0 ? breaks[breaks.length - 1].max_quantity || 0 : 0,
      max_quantity: undefined,
      discount_type: 'percentage',
      discount_value: 0,
      sort_order: breaks.length,
    }
    const updatedBreaks = [...breaks, newBreak]
    onChange(updatedBreaks)
    validateBreaks(updatedBreaks)
  }

  const updateBreak = (index: number, field: keyof QuantityBreak, value: any) => {
    const updatedBreaks = breaks.map((b, i) => {
      if (i === index) {
        return { ...b, [field]: value }
      }
      return b
    })
    onChange(updatedBreaks)
    validateBreaks(updatedBreaks)
  }

  const removeBreak = (index: number) => {
    const updatedBreaks = breaks.filter((_, i) => i !== index)
    onChange(updatedBreaks)
    validateBreaks(updatedBreaks)
  }

  const validateBreaks = (breaksToValidate: QuantityBreak[]) => {
    const validationErrors = validateQuantityBreaks(breaksToValidate)
    setErrors(validationErrors)
  }

  const formatDiscountDisplay = (type: string, value: number) => {
    switch (type) {
      case 'percentage':
        return `${value}%`
      case 'fixed':
        return `$${value}`
      case 'price':
        return `$${value}`
      default:
        return ''
    }
  }

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Min Quantity</TableHead>
              <TableHead>Max Quantity</TableHead>
              <TableHead>Discount Type</TableHead>
              <TableHead>Discount Value</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breaks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No quantity breaks defined. Click &quot;Add Break&quot; to get started.
                </TableCell>
              </TableRow>
            ) : (
              breaks.map((breakItem, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      type="number"
                      value={breakItem.min_quantity}
                      onChange={(e) =>
                        updateBreak(index, 'min_quantity', parseInt(e.target.value) || 0)
                      }
                      min="0"
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={breakItem.max_quantity || ''}
                      onChange={(e) =>
                        updateBreak(
                          index,
                          'max_quantity',
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      min={breakItem.min_quantity + 1}
                      placeholder="Unlimited"
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={breakItem.discount_type}
                      onValueChange={(value) => updateBreak(index, 'discount_type', value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                        <SelectItem value="price">Fixed Price</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {breakItem.discount_type === 'percentage' && (
                        <span className="text-muted-foreground">%</span>
                      )}
                      {breakItem.discount_type !== 'percentage' && (
                        <span className="text-muted-foreground">$</span>
                      )}
                      <Input
                        type="number"
                        step="0.01"
                        value={breakItem.discount_value}
                        onChange={(e) =>
                          updateBreak(index, 'discount_value', parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        className="w-24"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBreak(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Button onClick={addBreak} variant="outline" className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Break
      </Button>

      {breaks.length > 0 && (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Example pricing for these breaks:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            {breaks.map((breakItem, index) => (
              <li key={index}>
                {breakItem.min_quantity}
                {breakItem.max_quantity ? `-${breakItem.max_quantity}` : '+'} units:{' '}
                {formatDiscountDisplay(breakItem.discount_type, breakItem.discount_value)}
                {breakItem.discount_type === 'percentage' && ' off'}
                {breakItem.discount_type === 'fixed' && ' off per unit'}
                {breakItem.discount_type === 'price' && ' per unit'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}