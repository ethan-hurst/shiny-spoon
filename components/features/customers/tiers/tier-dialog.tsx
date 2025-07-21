'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerTierSchema } from '@/types/customer.types'
import { createTier, updateTier } from '@/app/actions/tiers'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Plus, X } from 'lucide-react'

interface TierDialogProps {
  tier?: any
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  existingLevels: number[]
}

type FormData = z.infer<typeof customerTierSchema>

// Common benefits options
const BENEFIT_SUGGESTIONS = [
  { key: 'free_shipping_threshold', label: 'Free Shipping Threshold', type: 'number' },
  { key: 'priority_support', label: 'Priority Support', type: 'boolean' },
  { key: 'dedicated_account_manager', label: 'Dedicated Account Manager', type: 'boolean' },
  { key: 'extended_payment_terms', label: 'Extended Payment Terms', type: 'boolean' },
  { key: 'volume_pricing', label: 'Volume Pricing', type: 'boolean' },
  { key: 'early_access', label: 'Early Access to New Products', type: 'boolean' },
]

// Common requirements options
const REQUIREMENT_SUGGESTIONS = [
  { key: 'min_annual_spend', label: 'Minimum Annual Spend', type: 'number' },
  { key: 'min_monthly_orders', label: 'Minimum Monthly Orders', type: 'number' },
  { key: 'years_as_customer', label: 'Years as Customer', type: 'number' },
  { key: 'payment_history', label: 'Good Payment History', type: 'boolean' },
]

// Preset colors
const TIER_COLORS = [
  { name: 'Bronze', color: '#CD7F32' },
  { name: 'Silver', color: '#C0C0C0' },
  { name: 'Gold', color: '#FFD700' },
  { name: 'Platinum', color: '#E5E4E2' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Green', color: '#10B981' },
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Red', color: '#EF4444' },
]

export function TierDialog({ tier, organizationId, open, onOpenChange, existingLevels }: TierDialogProps) {
  const router = useRouter()
  const isEditing = !!tier
  const [benefits, setBenefits] = useState<Record<string, any>>({})
  const [requirements, setRequirements] = useState<Record<string, any>>({})

  const form = useForm<FormData>({
    resolver: zodResolver(customerTierSchema),
    defaultValues: {
      name: '',
      level: Math.max(...existingLevels, 0) + 1,
      discount_percentage: 0,
      color: '#3B82F6',
      benefits: {},
      requirements: {},
    },
  })

  // Reset form when tier changes
  useEffect(() => {
    if (tier) {
      form.reset({
        name: tier.name,
        level: tier.level,
        discount_percentage: tier.discount_percentage,
        color: tier.color,
        benefits: tier.benefits || {},
        requirements: tier.requirements || {},
      })
      setBenefits(tier.benefits || {})
      setRequirements(tier.requirements || {})
    } else {
      form.reset({
        name: '',
        level: Math.max(...existingLevels, 0) + 1,
        discount_percentage: 0,
        color: '#3B82F6',
        benefits: {},
        requirements: {},
      })
      setBenefits({})
      setRequirements({})
    }
  }, [tier, existingLevels, form])

  const onSubmit = async (data: FormData) => {
    try {
      const formData = new FormData()
      formData.append('organization_id', organizationId)
      formData.append('name', data.name)
      formData.append('level', data.level.toString())
      formData.append('discount_percentage', data.discount_percentage.toString())
      formData.append('color', data.color)
      formData.append('benefits', JSON.stringify(benefits))
      formData.append('requirements', JSON.stringify(requirements))

      if (isEditing && tier) {
        formData.append('id', tier.id)
      }

      const result = isEditing 
        ? await updateTier(formData)
        : await createTier(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        isEditing 
          ? 'Tier updated successfully' 
          : 'Tier created successfully'
      )
      
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error('An unexpected error occurred')
    }
  }

  const addBenefit = (key: string, type: string) => {
    setBenefits(prev => ({
      ...prev,
      [key]: type === 'boolean' ? true : type === 'number' ? 0 : ''
    }))
  }

  const updateBenefit = (key: string, value: any) => {
    setBenefits(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const removeBenefit = (key: string) => {
    setBenefits(prev => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
  }

  const addRequirement = (key: string, type: string) => {
    setRequirements(prev => ({
      ...prev,
      [key]: type === 'boolean' ? true : type === 'number' ? 0 : ''
    }))
  }

  const updateRequirement = (key: string, value: any) => {
    setRequirements(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const removeRequirement = (key: string) => {
    setRequirements(prev => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Tier' : 'Create New Tier'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update the tier configuration below' 
                : 'Configure a new customer tier with pricing and benefits'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Information */}
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tier Name*</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="Gold"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">Level*</Label>
                  <Input
                    id="level"
                    type="number"
                    min="1"
                    max="10"
                    {...form.register('level', { valueAsNumber: true })}
                  />
                  {form.formState.errors.level && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.level.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Lower numbers = higher tiers
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount_percentage">Discount %</Label>
                  <Input
                    id="discount_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    {...form.register('discount_percentage', { valueAsNumber: true })}
                  />
                  {form.formState.errors.discount_percentage && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.discount_percentage.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      type="color"
                      {...form.register('color')}
                      className="w-16 h-10 p-1"
                    />
                    <div className="flex flex-wrap gap-1">
                      {TIER_COLORS.map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          className="w-8 h-8 rounded border-2 border-border hover:border-primary"
                          style={{ backgroundColor: preset.color }}
                          onClick={() => form.setValue('color', preset.color)}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {/* Benefits */}
              <AccordionItem value="benefits">
                <AccordionTrigger>
                  Benefits ({Object.keys(benefits).length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {/* Quick Add Benefits */}
                    <div className="space-y-2">
                      <Label>Quick Add</Label>
                      <div className="flex flex-wrap gap-2">
                        {BENEFIT_SUGGESTIONS.map((suggestion) => (
                          <Button
                            key={suggestion.key}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addBenefit(suggestion.key, suggestion.type)}
                            disabled={benefits.hasOwnProperty(suggestion.key)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            {suggestion.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Current Benefits */}
                    {Object.entries(benefits).map(([key, value]) => {
                      const suggestion = BENEFIT_SUGGESTIONS.find(s => s.key === key)
                      const type = suggestion?.type || (typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text')
                      
                      return (
                        <div key={key} className="flex gap-2 items-center">
                          <Input
                            value={key}
                            readOnly
                            className="flex-1"
                            placeholder="Benefit name"
                          />
                          {type === 'boolean' ? (
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => updateBenefit(key, e.target.checked)}
                              className="h-4 w-4"
                            />
                          ) : (
                            <Input
                              type={type}
                              value={value}
                              onChange={(e) => updateBenefit(key, type === 'number' ? Number(e.target.value) : e.target.value)}
                              className="w-32"
                              placeholder="Value"
                            />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBenefit(key)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}

                    {/* Add Custom Benefit */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const key = prompt('Enter benefit name (use underscore for spaces):')
                        if (key && !benefits.hasOwnProperty(key)) {
                          addBenefit(key, 'text')
                        }
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Custom Benefit
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Requirements */}
              <AccordionItem value="requirements">
                <AccordionTrigger>
                  Requirements ({Object.keys(requirements).length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {/* Quick Add Requirements */}
                    <div className="space-y-2">
                      <Label>Quick Add</Label>
                      <div className="flex flex-wrap gap-2">
                        {REQUIREMENT_SUGGESTIONS.map((suggestion) => (
                          <Button
                            key={suggestion.key}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addRequirement(suggestion.key, suggestion.type)}
                            disabled={requirements.hasOwnProperty(suggestion.key)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            {suggestion.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Current Requirements */}
                    {Object.entries(requirements).map(([key, value]) => {
                      const suggestion = REQUIREMENT_SUGGESTIONS.find(s => s.key === key)
                      const type = suggestion?.type || (typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text')
                      
                      return (
                        <div key={key} className="flex gap-2 items-center">
                          <Input
                            value={key}
                            readOnly
                            className="flex-1"
                            placeholder="Requirement name"
                          />
                          {type === 'boolean' ? (
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => updateRequirement(key, e.target.checked)}
                              className="h-4 w-4"
                            />
                          ) : (
                            <Input
                              type={type}
                              value={value}
                              onChange={(e) => updateRequirement(key, type === 'number' ? Number(e.target.value) : e.target.value)}
                              className="w-32"
                              placeholder="Value"
                            />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRequirement(key)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}

                    {/* Add Custom Requirement */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const key = prompt('Enter requirement name (use underscore for spaces):')
                        if (key && !requirements.hasOwnProperty(key)) {
                          addRequirement(key, 'text')
                        }
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Custom Requirement
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting 
                ? 'Saving...' 
                : isEditing 
                  ? 'Update Tier' 
                  : 'Create Tier'
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}