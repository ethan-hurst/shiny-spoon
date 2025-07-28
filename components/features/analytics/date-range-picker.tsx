// PRP-018: Analytics Dashboard - Date Range Picker Component
'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
  from: Date
  to: Date
}

export function DateRangePicker({ from, to }: DateRangePickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [date, setDate] = React.useState<DateRange | undefined>({
    from,
    to,
  })

  const updateDateRange = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to) return

    const params = new URLSearchParams(searchParams)
    params.set('from', format(range.from, 'yyyy-MM-dd'))
    params.set('to', format(range.to, 'yyyy-MM-dd'))

    router.push(`/analytics?${params.toString()}`)
  }

  const handlePresetSelect = (value: string) => {
    const today = new Date()
    let newRange: DateRange | undefined

    switch (value) {
      case 'last7':
        newRange = {
          from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          to: today,
        }
        break
      case 'last30':
        newRange = {
          from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          to: today,
        }
        break
      case 'last90':
        newRange = {
          from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
          to: today,
        }
        break
      case 'thisMonth':
        newRange = {
          from: new Date(today.getFullYear(), today.getMonth(), 1),
          to: today,
        }
        break
      case 'lastMonth':
        newRange = {
          from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
          to: new Date(today.getFullYear(), today.getMonth(), 0),
        }
        break
    }

    if (newRange) {
      setDate(newRange)
      updateDateRange(newRange)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select onValueChange={handlePresetSelect}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Quick select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last7">Last 7 days</SelectItem>
          <SelectItem value="last30">Last 30 days</SelectItem>
          <SelectItem value="last90">Last 90 days</SelectItem>
          <SelectItem value="thisMonth">This month</SelectItem>
          <SelectItem value="lastMonth">Last month</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[280px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} -{' '}
                  {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(newDate) => {
              setDate(newDate)
              if (newDate?.from && newDate?.to) {
                updateDateRange(newDate)
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}