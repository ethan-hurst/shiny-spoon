'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export function VersionSelector() {
  // In a real implementation, this would filter docs by version
  // For now, we'll just show a UI component
  const versions = [
    { value: 'v1', label: 'v1.0', status: 'stable' },
    { value: 'v2', label: 'v2.0', status: 'beta' },
  ]

  return (
    <Select defaultValue="v1">
      <SelectTrigger className="w-32">
        <SelectValue placeholder="Version" />
      </SelectTrigger>
      <SelectContent>
        {versions.map((version) => (
          <SelectItem key={version.value} value={version.value}>
            <div className="flex items-center gap-2">
              <span>{version.label}</span>
              {version.status === 'beta' && (
                <Badge variant="secondary" className="text-xs">
                  Beta
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}