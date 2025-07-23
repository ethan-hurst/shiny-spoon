'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Check, Sparkles, Calendar, CreditCard } from 'lucide-react'
import { changePlan } from '@/app/actions/billing'
import { BILLING_MESSAGES, ANNUAL_DISCOUNT_PERCENTAGE } from '@/lib/constants/billing'

interface Plan {
  id: string
  name: string
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  popular?: boolean
}

interface PlanSelectorProps {
  plans: Plan[]
  currentPlan: string
  currentInterval: 'month' | 'year'
}

export function PlanSelector({ plans, currentPlan, currentInterval }: PlanSelectorProps) {
  const [selectedInterval, setSelectedInterval] = useState(currentInterval)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleSelectPlan = async (planId: string) => {
    if (planId === currentPlan && selectedInterval === currentInterval) {
      return
    }

    setLoadingPlan(planId)
    
    const formData = new FormData()
    formData.append('plan', planId)
    formData.append('interval', selectedInterval)
    
    try {
      await changePlan(formData)
    } catch (error) {
      console.error('Error changing plan:', error)
      setLoadingPlan(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Billing Cycle Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Cycle</CardTitle>
          <CardDescription>
            Choose how often you'd like to be billed. {BILLING_MESSAGES.ANNUAL_DESCRIPTION}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={selectedInterval} 
            onValueChange={(value) => setSelectedInterval(value as 'month' | 'year')}
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
                  {BILLING_MESSAGES.MONTHLY_DESCRIPTION}
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
                    {BILLING_MESSAGES.ANNUAL_SAVINGS}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {BILLING_MESSAGES.ANNUAL_DESCRIPTION}
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Choose the plan that best fits your business needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlan
              const price = selectedInterval === 'year' 
                ? Math.floor(plan.yearlyPrice / 12)
                : plan.monthlyPrice

              return (
                <Card 
                  key={plan.id} 
                  className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {plan.name}
                      {isCurrentPlan && (
                        <Badge variant="secondary">Current</Badge>
                      )}
                    </CardTitle>
                    <div className="mt-4">
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold">${price}</span>
                        <span className="text-muted-foreground ml-1">
                          /{selectedInterval === 'year' ? 'month' : 'month'}
                        </span>
                      </div>
                      {selectedInterval === 'year' && (
                        <p className="text-sm text-muted-foreground mt-1">
                          ${plan.yearlyPrice}/year
                        </p>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={isCurrentPlan ? 'outline' : plan.popular ? 'default' : 'outline'}
                      disabled={isCurrentPlan && selectedInterval === currentInterval || loadingPlan !== null}
                      onClick={() => handleSelectPlan(plan.id)}
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                          Processing...
                        </>
                      ) : isCurrentPlan && selectedInterval === currentInterval ? (
                        'Current Plan'
                      ) : isCurrentPlan ? (
                        `Switch to ${selectedInterval === 'year' ? 'Annual' : 'Monthly'}`
                      ) : currentPlan === 'free' || plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === currentPlan) ? (
                        'Upgrade'
                      ) : (
                        'Downgrade'
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              All plans include SSL certificates, 99.9% uptime SLA, and 24/7 monitoring
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Need a custom plan? <a href="/contact" className="underline">Contact sales</a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}