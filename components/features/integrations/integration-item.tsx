'use client'

import { 
  MoreHorizontal, 
  Play, 
  Pause, 
  RefreshCw, 
  Settings, 
  Trash,
  ShoppingBag,
  BarChart3,
  DollarSign,
  Building2,
  Briefcase,
  Wrench,
  Link as LinkIcon
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { IntegrationFull, SyncJob, IntegrationStatusType, IntegrationPlatformType } from '@/types/integration.types'

interface IntegrationItemProps {
  integration: IntegrationFull
  onSync: (id: string) => Promise<void> | void
  onToggleStatus: (id: string, currentStatus: IntegrationStatusType) => Promise<void> | void
  onDelete: (id: string) => Promise<void> | void
  isLoading: boolean
}

const platformIcons: Record<IntegrationPlatformType, React.ComponentType<{ className?: string }>> = {
  shopify: ShoppingBag,
  netsuite: BarChart3,
  quickbooks: DollarSign,
  sap: Building2,
  dynamics365: Briefcase,
  custom: Wrench,
}

const statusColors: Record<IntegrationStatusType, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  error: 'bg-red-100 text-red-800',
  configuring: 'bg-blue-100 text-blue-800',
  suspended: 'bg-yellow-100 text-yellow-800',
}

export function IntegrationItem({ 
  integration, 
  onSync, 
  onToggleStatus, 
  onDelete, 
  isLoading 
}: IntegrationItemProps) {
  const lastSyncDate = integration.last_sync_at
    ? (() => {
        const date = new Date(integration.last_sync_at)
        return !isNaN(date.getTime()) ? date : null
      })()
    : null
  const hasError = integration.status === 'error'
  const runningJobs = Array.isArray(integration.sync_jobs)
    ? integration.sync_jobs.filter(
        (job): job is SyncJob => job && typeof job === 'object' && (job as SyncJob).status === 'running'
      ).length
    : 0

  const IconComponent = platformIcons[integration.platform as IntegrationPlatformType] || LinkIcon

  return (
    <div className="p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback>
              <IconComponent className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Link
                href={`/integrations/${integration.id}`}
                className="font-medium hover:underline"
              >
                {integration.name}
              </Link>
              <Badge
                variant="secondary"
                className={statusColors[integration.status as IntegrationStatusType]}
              >
                {integration.status}
              </Badge>
              {runningJobs > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  Syncing
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span className="capitalize">{integration.platform}</span>
              {lastSyncDate && (
                <>
                  <span>•</span>
                  <span>
                    Last sync: {(() => {
                      try {
                        return format(lastSyncDate, 'MMM d, h:mm a')
                      } catch (error) {
                        console.error('Invalid date format:', error)
                        return 'Invalid date'
                      }
                    })()}
                  </span>
                </>
              )}
              {hasError && integration.error_count > 0 && (
                <>
                  <span>•</span>
                  <span className="text-red-600">
                    {integration.error_count} errors
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSync(integration.id)}
            disabled={isLoading || integration.status !== 'active'}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} ${isLoading ? 'mr-2' : 'mr-1'}`} />
            {isLoading ? 'Syncing...' : 'Sync Now'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isLoading}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onToggleStatus(integration.id, integration.status as IntegrationStatusType)}
              >
                {integration.status === 'active' ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Integration
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Activate Integration
                  </>
                )}
              </DropdownMenuItem>
              
              <DropdownMenuItem asChild>
                <Link href={`/integrations/${integration.id}/settings`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem asChild>
                <Link href={`/integrations/${integration.id}/logs`}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  View Logs
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => onDelete(integration.id)}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}