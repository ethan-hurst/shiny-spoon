// PRP-015: Sync Jobs List Component
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/components/ui/use-toast'
import { 
  MoreHorizontal, 
  Play, 
  Square, 
  RotateCcw, 
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { cancelSyncJob, retrySyncJob } from '@/app/actions/sync-engine'
import type { SyncJob } from '@/types/sync-engine.types'

interface SyncJobsListProps {
  jobs: (SyncJob & {
    integrations: {
      id: string
      name: string
      platform: string
    }
  })[]
}

export function SyncJobsList({ jobs }: SyncJobsListProps) {
  const router = useRouter()
  const [processingJobs, setProcessingJobs] = useState<Set<string>>(new Set())

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      failed: 'destructive',
      running: 'secondary',
      pending: 'outline',
      cancelled: 'outline',
    }

    return (
      <Badge variant={variants[status] || 'outline'} className="gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatDuration = (durationMs?: number) => {
    if (!durationMs) return '-'
    
    const seconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }

  const handleCancel = async (jobId: string) => {
    setProcessingJobs(prev => new Set(prev).add(jobId))
    
    try {
      const formData = new FormData()
      formData.append('job_id', jobId)
      
      await cancelSyncJob(formData)
      
      toast({
        title: 'Job cancelled',
        description: 'The sync job has been cancelled.',
      })
      
      router.refresh()
    } catch (error) {
      toast({
        title: 'Cancel failed',
        description: error instanceof Error ? error.message : 'Failed to cancel job',
        variant: 'destructive',
      })
    } finally {
      setProcessingJobs(prev => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
    }
  }

  const handleRetry = async (jobId: string) => {
    setProcessingJobs(prev => new Set(prev).add(jobId))
    
    try {
      const formData = new FormData()
      formData.append('job_id', jobId)
      
      await retrySyncJob(formData)
      
      toast({
        title: 'Retry started',
        description: 'A new sync job has been created.',
      })
      
      router.refresh()
    } catch (error) {
      toast({
        title: 'Retry failed',
        description: error instanceof Error ? error.message : 'Failed to retry job',
        variant: 'destructive',
      })
    } finally {
      setProcessingJobs(prev => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
    }
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Integration</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Entities</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Started</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const isProcessing = processingJobs.has(job.id)
            const progress = job.progress
            const progressPercentage = progress?.percentage || 0
            
            return (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  {job.integrations.name}
                  <div className="text-xs text-muted-foreground">
                    {job.integrations.platform}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {job.job_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {(job.config as any).entity_types?.join(', ') || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(job.status)}
                </TableCell>
                <TableCell>
                  {job.status === 'running' && progress ? (
                    <div className="space-y-1">
                      <Progress value={progressPercentage} className="h-2" />
                      <div className="text-xs text-muted-foreground">
                        {progress.records_processed} / {progress.records_total || '?'} records
                      </div>
                    </div>
                  ) : job.result ? (
                    <div className="text-xs">
                      {job.result.summary.total_processed} processed
                      {job.result.summary.failed > 0 && (
                        <span className="text-destructive ml-1">
                          ({job.result.summary.failed} failed)
                        </span>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {formatDuration(job.duration_ms)}
                </TableCell>
                <TableCell>
                  {job.started_at ? (
                    <div className="text-sm">
                      {formatDistanceToNow(new Date(job.started_at), { addSuffix: true })}
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0"
                        disabled={isProcessing}
                      >
                        <span className="sr-only">Open menu</span>
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/sync/jobs/${job.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {job.status === 'running' && (
                        <DropdownMenuItem
                          onClick={() => handleCancel(job.id)}
                          className="text-destructive"
                        >
                          <Square className="mr-2 h-4 w-4" />
                          Cancel Job
                        </DropdownMenuItem>
                      )}
                      {job.status === 'failed' && (
                        <DropdownMenuItem
                          onClick={() => handleRetry(job.id)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Retry Job
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      
      {jobs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No sync jobs found
        </div>
      )}
    </div>
  )
}