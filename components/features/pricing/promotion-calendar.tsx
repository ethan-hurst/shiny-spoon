'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  formatDiscountDisplay,
  PricingRuleRecord,
} from '@/types/pricing.types'

export function PromotionCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [promotions, setPromotions] = useState<PricingRuleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchPromotions()
  }, [currentMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPromotions() {
    try {
      const start = startOfMonth(currentMonth)
      const end = endOfMonth(currentMonth)

      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('rule_type', 'promotion')
        .lte('start_date', end.toISOString().split('T')[0])
        .or(
          `end_date.gte.${start.toISOString().split('T')[0]},end_date.is.null`
        )
        .order('start_date', { ascending: true })

      if (error) throw error
      setPromotions(data || [])
    } catch (error) {
      console.error('Error fetching promotions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Group promotions by day
  const promotionsByDay = promotions.reduce(
    (acc, rule) => {
      const startDate = rule.start_date ? new Date(rule.start_date) : new Date()
      const endDate = rule.end_date
        ? new Date(rule.end_date)
        : endOfMonth(currentMonth)

      const days = eachDayOfInterval({ start: startDate, end: endDate })

      days.forEach((day) => {
        const dayKey = format(day, 'yyyy-MM-dd')
        if (!acc[dayKey]) {
          acc[dayKey] = []
        }
        acc[dayKey].push(rule)
      })

      return acc
    },
    {} as Record<string, PricingRuleRecord[]>
  )

  const getDayPromotions = (date: Date) => {
    const dayKey = format(date, 'yyyy-MM-dd')
    return promotionsByDay[dayKey] || []
  }

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth(
      direction === 'prev'
        ? subMonths(currentMonth, 1)
        : addMonths(currentMonth, 1)
    )
  }

  const PromotionList = ({ date }: { date: Date }) => {
    const dayPromotions = getDayPromotions(date)

    if (dayPromotions.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground">
          No promotions on this day
        </div>
      )
    }

    return (
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-2">
          {dayPromotions.map((rule) => (
            <div
              key={rule.id}
              className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
              onClick={() => router.push(`/pricing/rules/${rule.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{rule.name}</h4>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {rule.description}
                    </p>
                  )}
                </div>
                <Badge
                  variant={rule.is_active ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {rule.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {rule.discount_type && rule.discount_value && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    {formatDiscountDisplay(
                      rule.discount_type,
                      rule.discount_value
                    )}
                  </Badge>
                </div>
              )}
              <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                {rule.start_date && (
                  <span>
                    From: {format(new Date(rule.start_date), 'MMM d')}
                  </span>
                )}
                {rule.end_date && (
                  <span>To: {format(new Date(rule.end_date), 'MMM d')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Promotion Calendar</CardTitle>
            <CardDescription>
              View and manage promotional pricing rules by date
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleMonthChange('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[120px] text-center font-medium">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleMonthChange('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => router.push('/pricing/rules/new?type=promotion')}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Promotion
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading promotions...</div>
        ) : (
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-md border"
              components={{
                Day: ({ date, ...props }) => {
                  const dayPromotions = getDayPromotions(date)
                  const hasPromotions = dayPromotions.length > 0
                  const hasActivePromotions = dayPromotions.some(
                    (p) => p.is_active
                  )

                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          {...props}
                          className={cn(
                            hasPromotions && 'relative',
                            'hover:bg-accent focus:bg-accent'
                          )}
                        >
                          {format(date, 'd')}
                          {hasPromotions && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                              <div
                                className={cn(
                                  'w-1 h-1 rounded-full',
                                  hasActivePromotions
                                    ? 'bg-primary'
                                    : 'bg-muted-foreground'
                                )}
                              />
                            </div>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <div className="p-4 border-b">
                          <h3 className="font-medium">
                            {format(date, 'EEEE, MMMM d, yyyy')}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {dayPromotions.length} promotion
                            {dayPromotions.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="p-4">
                          <PromotionList date={date} />
                        </div>
                      </PopoverContent>
                    </Popover>
                  )
                },
              }}
            />

            {/* Promotion Summary */}
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-3">Active Promotions This Month</h3>
              {promotions.filter((p) => p.is_active).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active promotions scheduled for{' '}
                  {format(currentMonth, 'MMMM yyyy')}
                </p>
              ) : (
                <div className="space-y-2">
                  {promotions
                    .filter((p) => p.is_active)
                    .slice(0, 5)
                    .map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
                        onClick={() => router.push(`/pricing/rules/${rule.id}`)}
                      >
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            {rule.name}
                          </span>
                          {rule.discount_type && rule.discount_value && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {formatDiscountDisplay(
                                rule.discount_type,
                                rule.discount_value
                              )}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rule.start_date &&
                            format(new Date(rule.start_date), 'MMM d')}
                          {rule.end_date &&
                            ` - ${format(new Date(rule.end_date), 'MMM d')}`}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
