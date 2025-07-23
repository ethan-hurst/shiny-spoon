'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar, CreditCard } from 'lucide-react'

interface BillingCycleProps {
  currentInterval: 'month' | 'year'
  onChange?: (interval: 'month' | 'year') => void
}

export function BillingCycle({ currentInterval, onChange }: BillingCycleProps) {
  const [selectedInterval, setSelectedInterval] = useState(currentInterval)

  const handleChange = (value: string) => {
    setSelectedInterval(value as 'month' | 'year')
    onChange?.(value as 'month' | 'year')
  }

  const savings = {
    starter: 99 * 2, // 2 months free
    growth: 299 * 2,
    scale: 799 * 2,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing Cycle</CardTitle>
        <CardDescription>
          Choose how often you'd like to be billed. Save 2 months with annual billing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup 
          value={selectedInterval} 
          onValueChange={handleChange}
          className="grid md:grid-cols-2 gap-4"
        >
          <div className="relative">
            <RadioGroupItem 
              value="month" 
              id="monthly" 
              className="peer sr-only" 
            />
            <Label
              htmlFor="monthly"
              className="flex flex-col gap-3 rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Monthly billing</span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Pay month-to-month with the flexibility to cancel anytime
              </div>
            </Label>
          </div>

          <div className="relative">
            <RadioGroupItem 
              value="year" 
              id="yearly" 
              className="peer sr-only" 
            />
            <Label
              htmlFor="yearly"
              className="flex flex-col gap-3 rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">Annual billing</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                  Save 17%
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Pay annually and get 2 months free on any plan
              </div>
            </Label>
          </div>
        </RadioGroup>

        {selectedInterval === 'year' && (
          <div className="mt-4 text-sm text-muted-foreground">
            💡 <span className="font-medium">Tip:</span> Annual billing saves you up to $1,598/year on our Scale plan!
          </div>
        )}
      </CardContent>
    </Card>
  )
}