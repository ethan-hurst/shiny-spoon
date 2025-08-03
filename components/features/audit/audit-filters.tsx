// components/features/audit/audit-filters.tsx
'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
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

interface User {
  user_id: string
  full_name?: string
  email: string
}

interface AuditFiltersProps {
  users: User[]
  currentFilters: {
    user_id?: string
    action?: string
    entity_type?: string
    from: Date
    to: Date
  }
}

const actions = [
  'create',
  'update',
  'delete',
  'view',
  'export',
  'login',
  'logout',
  'invite',
  'sync',
  'approve',
  'reject',
]

const entityTypes = [
  'product',
  'inventory',
  'order',
  'customer',
  'pricing_rule',
  'warehouse',
  'integration',
  'user',
  'organization',
]

export function AuditFilters({ users, currentFilters }: AuditFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: currentFilters.from,
    to: currentFilters.to,
  })

  const updateFilters = (updates: Record<string, any>) => {
    const params = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    // Reset to page 1 when filters change
    params.set('page', '1')

    router.push(`/audit?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push('/audit')
  }

  const activeFilterCount = [
    currentFilters.user_id,
    currentFilters.action,
    currentFilters.entity_type,
  ].filter(Boolean).length

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[300px] justify-start text-left font-normal',
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
                  updateFilters({
                    from: format(newDate.from, 'yyyy-MM-dd'),
                    to: format(newDate.to, 'yyyy-MM-dd'),
                  })
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* User Filter */}
        <Select
          value={currentFilters.user_id || ''}
          onValueChange={(value) => updateFilters({ user: value || null })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All users</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.user_id} value={user.user_id}>
                {user.full_name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action Filter */}
        <Select
          value={currentFilters.action || ''}
          onValueChange={(value) => updateFilters({ action: value || null })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All actions</SelectItem>
            {actions.map((action) => (
              <SelectItem key={action} value={action}>
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Entity Type Filter */}
        <Select
          value={currentFilters.entity_type || ''}
          onValueChange={(value) => updateFilters({ entity: value || null })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All entities</SelectItem>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9"
          >
            Clear filters
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          </Button>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Quick filters:</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            updateFilters({
              from: format(
                new Date(Date.now() - 24 * 60 * 60 * 1000),
                'yyyy-MM-dd'
              ),
              to: format(new Date(), 'yyyy-MM-dd'),
            })
          }
        >
          Last 24 hours
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            updateFilters({
              from: format(
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                'yyyy-MM-dd'
              ),
              to: format(new Date(), 'yyyy-MM-dd'),
            })
          }
        >
          Last 7 days
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            updateFilters({
              from: format(
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                'yyyy-MM-dd'
              ),
              to: format(new Date(), 'yyyy-MM-dd'),
            })
          }
        >
          Last 30 days
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => updateFilters({ action: 'login,logout' })}
        >
          Authentication events
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => updateFilters({ action: 'create,update,delete' })}
        >
          Data changes
        </Button>
      </div>
    </div>
  )
}
