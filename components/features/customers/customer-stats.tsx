'use client'

import { UserCheck, UserMinus, Users, UserX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CustomerStatsProps {
  stats: {
    total_customers: number
    active_customers: number
    inactive_customers: number
    suspended_customers: number
    by_tier?: Array<{
      tier_name: string
      count: number
    }>
  }
}

export function CustomerStats({ stats }: CustomerStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_customers}</div>
          {stats.by_tier && stats.by_tier.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              {stats.by_tier.map((tier, index) => (
                <span key={tier.tier_name}>
                  {tier.count} {tier.tier_name}
                  {index < stats.by_tier!.length - 1 && ', '}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active</CardTitle>
          <UserCheck className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.active_customers}</div>
          <p className="text-xs text-muted-foreground">
            {stats.total_customers > 0
              ? `${Math.round((stats.active_customers / stats.total_customers) * 100)}% of total`
              : '0% of total'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Inactive</CardTitle>
          <UserMinus className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.inactive_customers}</div>
          <p className="text-xs text-muted-foreground">
            {stats.total_customers > 0
              ? `${Math.round((stats.inactive_customers / stats.total_customers) * 100)}% of total`
              : '0% of total'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Suspended</CardTitle>
          <UserX className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.suspended_customers}</div>
          <p className="text-xs text-muted-foreground">
            {stats.total_customers > 0
              ? `${Math.round((stats.suspended_customers / stats.total_customers) * 100)}% of total`
              : '0% of total'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
