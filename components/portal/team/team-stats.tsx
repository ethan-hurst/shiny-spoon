import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, Shield, Clock } from 'lucide-react'

interface TeamStatsProps {
  stats: {
    totalMembers: number
    admins: number
    activeToday: number
    pendingInvites: number
  }
}

export function TeamStats({ stats }: TeamStatsProps) {
  const items = [
    {
      title: 'Total Members',
      value: stats.totalMembers,
      icon: Users,
      description: 'Active team members',
      color: 'text-blue-600',
    },
    {
      title: 'Admins',
      value: stats.admins,
      icon: Shield,
      description: 'Admin users',
      color: 'text-purple-600',
    },
    {
      title: 'Active Today',
      value: stats.activeToday,
      icon: UserCheck,
      description: 'Signed in today',
      color: 'text-green-600',
    },
    {
      title: 'Pending Invites',
      value: stats.pendingInvites,
      icon: Clock,
      description: 'Awaiting response',
      color: 'text-amber-600',
    },
  ]

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}