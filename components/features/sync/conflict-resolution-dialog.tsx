'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, Database, Globe, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import type { SyncConflict } from '@/types/sync-engine.types'

interface ConflictResolutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: SyncConflict[]
  onResolve: (conflictId: string, resolution: 'source' | 'target' | 'merge') => Promise<void>
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  conflicts,
  onResolve,
}: ConflictResolutionDialogProps) {
  const [resolving, setResolving] = useState(false)
  const [resolutions, setResolutions] = useState<Record<string, 'source' | 'target' | 'merge'>>({})

  const handleResolve = async () => {
    setResolving(true)
    try {
      // Resolve all conflicts
      const resolvePromises = conflicts.map(conflict => {
        const resolution = resolutions[conflict.id] || 'target' // Default to target (external system)
        return onResolve(conflict.id, resolution)
      })

      await Promise.all(resolvePromises)
      toast.success(`Resolved ${conflicts.length} conflict(s)`)
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to resolve conflicts')
    } finally {
      setResolving(false)
    }
  }

  const getConflictIcon = (entityType: string) => {
    switch (entityType) {
      case 'inventory':
        return Database
      case 'product':
        return Globe
      default:
        return AlertTriangle
    }
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'Not set'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Sync Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} need{conflicts.length === 1 ? 's' : ''} to be resolved. Choose which version to keep for each conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          {conflicts.map((conflict, index) => {
            const Icon = getConflictIcon(conflict.entity_type)
            
            return (
              <Card key={conflict.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {conflict.entity_type.charAt(0).toUpperCase() + conflict.entity_type.slice(1)} Conflict
                    </CardTitle>
                    <Badge variant="secondary">{conflict.field_name}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Entity ID: {conflict.entity_id}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={resolutions[conflict.id] || 'target'}
                    onValueChange={(value: 'source' | 'target' | 'merge') => 
                      setResolutions(prev => ({ ...prev, [conflict.id]: value }))
                    }
                  >
                    <div className="space-y-3">
                      {/* Local value option */}
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="source" id={`${conflict.id}-source`} />
                        <Label 
                          htmlFor={`${conflict.id}-source`} 
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">Keep Local Value</span>
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(conflict.source_updated_at), 'MMM d, h:mm a')}
                            </Badge>
                          </div>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {formatValue(conflict.source_value)}
                          </code>
                        </Label>
                      </div>

                      <Separator />

                      {/* External value option */}
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="target" id={`${conflict.id}-target`} />
                        <Label 
                          htmlFor={`${conflict.id}-target`} 
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">Keep External Value</span>
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(conflict.target_updated_at), 'MMM d, h:mm a')}
                            </Badge>
                          </div>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {formatValue(conflict.target_value)}
                          </code>
                        </Label>
                      </div>

                      {/* Merge option if applicable */}
                      {conflict.resolved_value && (
                        <>
                          <Separator />
                          <div className="flex items-start space-x-3">
                            <RadioGroupItem value="merge" id={`${conflict.id}-merge`} />
                            <Label 
                              htmlFor={`${conflict.id}-merge`} 
                              className="flex-1 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">Use Merged Value</span>
                                <Badge variant="secondary" className="text-xs">
                                  Recommended
                                </Badge>
                              </div>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {formatValue(conflict.resolved_value)}
                              </code>
                            </Label>
                          </div>
                        </>
                      )}
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={resolving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            disabled={resolving}
          >
            {resolving ? 'Resolving...' : 'Resolve Conflicts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}