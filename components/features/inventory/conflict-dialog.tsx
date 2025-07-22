'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConflictResolver, ConflictResolverProps } from './conflict-resolver'

interface ConflictDialogProps extends ConflictResolverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
}

export function ConflictDialog({
  open,
  onOpenChange,
  title = 'Resolve Update Conflict',
  description = 'Another user has made changes to this item. Please resolve the conflict to continue.',
  ...resolverProps
}: ConflictDialogProps) {
  const handleResolve = (
    resolution: 'local' | 'server' | 'merge',
    mergedValue?: any
  ) => {
    resolverProps.onResolve(resolution, mergedValue)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ConflictResolver {...resolverProps} onResolve={handleResolve} />
      </DialogContent>
    </Dialog>
  )
}
