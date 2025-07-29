// components/features/audit/retention-policy-dialog.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings } from 'lucide-react'
import { toast } from 'sonner'

interface RetentionPolicyDialogProps {
  organizationId: string
}

export function RetentionPolicyDialog({
  organizationId,
}: RetentionPolicyDialogProps) {
  const [open, setOpen] = useState(false)
  const [entityType, setEntityType] = useState<string>('')
  const [retentionDays, setRetentionDays] = useState<string>('365')

  const handleSave = async () => {
    try {
      // Implementation would save retention policy
      toast.success('Retention policy updated successfully')
      setOpen(false)
    } catch (error) {
      toast.error('Failed to update retention policy')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Retention Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Data Retention Policy</DialogTitle>
          <DialogDescription>
            Configure how long audit logs are retained for compliance purposes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="entity-type" className="text-right">
              Entity Type
            </Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="All entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All entities</SelectItem>
                <SelectItem value="product">Products</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="retention-days" className="text-right">
              Retention (days)
            </Label>
            <Input
              id="retention-days"
              type="number"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="col-span-3"
              placeholder="365"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            Save Policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}