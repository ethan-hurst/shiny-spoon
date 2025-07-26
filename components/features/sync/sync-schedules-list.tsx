// PRP-015: Sync Schedules List Component
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import { 
  Clock, 
  Play,
  Settings,
  Calendar,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { updateSyncSchedule, deleteSyncSchedule } from '@/app/actions/sync-engine'
import { SyncScheduleDialog } from './sync-schedule-dialog'
import type { SyncSchedule } from '@/types/sync-engine.types'

interface SyncSchedulesListProps {
  schedules: (SyncSchedule & {
    integrations: {
      id: string
      name: string
      platform: string
    }
  })[]
}

export function SyncSchedulesList({ schedules }: SyncSchedulesListProps) {
  const router = useRouter()
  const [processingSchedules, setProcessingSchedules] = useState<Set<string>>(new Set())
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      every_5_min: 'Every 5 minutes',
      every_15_min: 'Every 15 minutes',
      every_30_min: 'Every 30 minutes',
      hourly: 'Every hour',
      daily: 'Daily',
      weekly: 'Weekly',
    }
    return labels[frequency] || frequency
  }

  const getFrequencyIcon = (frequency: string) => {
    if (frequency.includes('min') || frequency === 'hourly') {
      return <Clock className="h-4 w-4" />
    }
    return <Calendar className="h-4 w-4" />
  }

  const handleToggleEnabled = async (schedule: any, enabled: boolean) => {
    setProcessingSchedules(prev => new Set(prev).add(schedule.id))
    
    try {
      const formData = new FormData()
      formData.append('integration_id', schedule.integration_id)
      formData.append('enabled', enabled.toString())
      formData.append('frequency', schedule.frequency)
      schedule.entity_types.forEach((type: string) => {
        formData.append('entity_types', type)
      })
      
      if (schedule.active_hours) {
        formData.append('active_hours_enabled', 'true')
        formData.append('active_hours_start', schedule.active_hours.start)
        formData.append('active_hours_end', schedule.active_hours.end)
      }
      
      await updateSyncSchedule(formData)
      
      toast({
        title: enabled ? 'Schedule enabled' : 'Schedule disabled',
        description: `Sync schedule has been ${enabled ? 'enabled' : 'disabled'}.`,
      })
      
      router.refresh()
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update schedule',
        variant: 'destructive',
      })
    } finally {
      setProcessingSchedules(prev => {
        const next = new Set(prev)
        next.delete(schedule.id)
        return next
      })
    }
  }

  const handleDelete = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return
    }
    
    try {
      const formData = new FormData()
      formData.append('integration_id', integrationId)
      
      await deleteSyncSchedule(formData)
      
      toast({
        title: 'Schedule deleted',
        description: 'The sync schedule has been deleted.',
      })
      
      router.refresh()
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete schedule',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Integration</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Entities</TableHead>
            <TableHead>Active Hours</TableHead>
            <TableHead>Last Run</TableHead>
            <TableHead>Next Run</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((schedule) => {
            const isProcessing = processingSchedules.has(schedule.id)
            const isOverdue = schedule.next_run_at && 
              new Date(schedule.next_run_at) < new Date()
            
            return (
              <TableRow key={schedule.id}>
                <TableCell className="font-medium">
                  {schedule.integrations.name}
                  <div className="text-xs text-muted-foreground">
                    {schedule.integrations.platform}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getFrequencyIcon(schedule.frequency)}
                    <span className="text-sm">
                      {getFrequencyLabel(schedule.frequency)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {schedule.entity_types.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {schedule.active_hours ? (
                    <div className="text-sm">
                      {schedule.active_hours.start} - {schedule.active_hours.end}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Always</span>
                  )}
                </TableCell>
                <TableCell>
                  {schedule.last_run_at ? (
                    <div className="text-sm">
                      {formatDistanceToNow(new Date(schedule.last_run_at), { addSuffix: true })}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  {schedule.next_run_at ? (
                    <div className="flex items-center gap-1">
                      {isOverdue && schedule.enabled && (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className={`text-sm ${isOverdue && schedule.enabled ? 'text-yellow-600' : ''}`}>
                        {formatDistanceToNow(new Date(schedule.next_run_at), { addSuffix: true })}
                      </span>
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={schedule.enabled}
                    onCheckedChange={(checked) => handleToggleEnabled(schedule, checked)}
                    disabled={isProcessing}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSchedule(schedule.integration_id)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      
      {schedules.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No sync schedules configured
        </div>
      )}

      {editingSchedule && (
        <SyncScheduleDialog
          integrationId={editingSchedule}
          schedule={schedules.find(s => s.integration_id === editingSchedule)}
          onClose={() => setEditingSchedule(null)}
        />
      )}
    </div>
  )
}