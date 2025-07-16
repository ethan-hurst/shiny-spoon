'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export interface ConflictResolverProps {
  localValue: any
  serverValue: any
  fieldName?: string
  onResolve: (resolution: 'local' | 'server' | 'merge', mergedValue?: any) => void
}

export function ConflictResolver({ 
  localValue, 
  serverValue, 
  fieldName = 'value',
  onResolve 
}: ConflictResolverProps) {
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'server' | 'merge'>('server')
  const [mergedValue, setMergedValue] = useState<any>(serverValue)

  const renderValue = (value: any, label: string, meta?: { timestamp?: string; user?: string }) => {
    const isObject = typeof value === 'object' && value !== null
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{label}</h4>
          {meta && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {meta.timestamp && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(meta.timestamp), 'MMM d, h:mm a')}
                </div>
              )}
              {meta.user && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {meta.user}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="rounded-md border p-3 bg-muted/30">
          {isObject ? (
            <pre className="text-sm overflow-auto max-h-40">
              {JSON.stringify(value, null, 2)}
            </pre>
          ) : (
            <p className="text-sm font-mono">{String(value)}</p>
          )}
        </div>
      </div>
    )
  }

  const getChangedFields = () => {
    if (typeof localValue !== 'object' || typeof serverValue !== 'object') {
      return localValue !== serverValue ? [fieldName] : []
    }

    const changedFields: string[] = []
    const allKeys = new Set([
      ...Object.keys(localValue || {}),
      ...Object.keys(serverValue || {})
    ])

    allKeys.forEach(key => {
      if (JSON.stringify(localValue[key]) !== JSON.stringify(serverValue[key])) {
        changedFields.push(key)
      }
    })

    return changedFields
  }

  const changedFields = getChangedFields()

  const handleResolve = () => {
    if (selectedResolution === 'merge') {
      onResolve('merge', mergedValue)
    } else {
      onResolve(selectedResolution)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-amber-600">
        <AlertTriangle className="h-5 w-5" />
        <h3 className="font-semibold">Conflict Detected</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        The {fieldName} has been modified by another user while you were making changes. 
        Please choose how to resolve this conflict.
      </p>

      {changedFields.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Changed fields:</span>
          <div className="flex gap-1 flex-wrap">
            {changedFields.map(field => (
              <Badge key={field} variant="outline" className="text-xs">
                {field}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        {renderValue(
          localValue,
          'Your Changes',
          { timestamp: new Date().toISOString(), user: 'You' }
        )}
        
        {renderValue(
          serverValue,
          'Current Server Value',
          { 
            timestamp: serverValue?.updated_at || new Date().toISOString(),
            user: serverValue?.updated_by || 'Another user'
          }
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <Label>Choose Resolution Strategy</Label>
        
        <RadioGroup
          value={selectedResolution}
          onValueChange={(value) => setSelectedResolution(value as 'local' | 'server' | 'merge')}
        >
          <div className="space-y-2">
            <div className="flex items-center space-x-2 p-3 rounded-md hover:bg-muted/50">
              <RadioGroupItem value="local" id="local" />
              <Label 
                htmlFor="local" 
                className="flex-1 cursor-pointer font-normal"
              >
                <div>
                  <p className="font-medium">Keep My Changes</p>
                  <p className="text-sm text-muted-foreground">
                    Overwrite the server value with your local changes
                  </p>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2 p-3 rounded-md hover:bg-muted/50">
              <RadioGroupItem value="server" id="server" />
              <Label 
                htmlFor="server" 
                className="flex-1 cursor-pointer font-normal"
              >
                <div>
                  <p className="font-medium">Use Server Value</p>
                  <p className="text-sm text-muted-foreground">
                    Discard your changes and use the current server value
                  </p>
                </div>
              </Label>
            </div>
            
            {typeof localValue === 'object' && typeof serverValue === 'object' && (
              <div className="flex items-center space-x-2 p-3 rounded-md hover:bg-muted/50">
                <RadioGroupItem value="merge" id="merge" />
                <Label 
                  htmlFor="merge" 
                  className="flex-1 cursor-pointer font-normal"
                >
                  <div>
                    <p className="font-medium">Manual Merge</p>
                    <p className="text-sm text-muted-foreground">
                      Manually combine changes from both versions
                    </p>
                  </div>
                </Label>
              </div>
            )}
          </div>
        </RadioGroup>
      </div>

      {selectedResolution === 'merge' && typeof mergedValue === 'object' && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label>Merged Result (Editable)</Label>
            <textarea
              className={cn(
                "w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2",
                "text-sm font-mono resize-y"
              )}
              value={JSON.stringify(mergedValue, null, 2)}
              onChange={(e) => {
                try {
                  setMergedValue(JSON.parse(e.target.value))
                } catch {
                  // Invalid JSON, keep as is
                }
              }}
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button
          variant="outline"
          onClick={() => onResolve('server')}
        >
          Cancel
        </Button>
        <Button
          onClick={handleResolve}
          className={cn(
            selectedResolution === 'local' && 'bg-amber-600 hover:bg-amber-700'
          )}
        >
          {selectedResolution === 'local' && 'Use My Changes'}
          {selectedResolution === 'server' && 'Use Server Value'}
          {selectedResolution === 'merge' && 'Apply Merged Value'}
        </Button>
      </div>
    </div>
  )
}