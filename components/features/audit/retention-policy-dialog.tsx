// components/features/audit/retention-policy-dialog.tsx
'use client'

import { useState } from 'react'
import { Plus, Save, Settings, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface RetentionPolicyDialogProps {
  organizationId: string
}

interface RetentionPolicy {
  id?: string
  entity_type: string
  retention_days: number
  is_active: boolean
}

const entityTypes = [
  { value: '', label: 'All Entities (Default)' },
  { value: 'product', label: 'Products' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'order', label: 'Orders' },
  { value: 'customer', label: 'Customers' },
  { value: 'pricing_rule', label: 'Pricing Rules' },
  { value: 'warehouse', label: 'Warehouses' },
  { value: 'integration', label: 'Integrations' },
  { value: 'user', label: 'Users' },
]

export function RetentionPolicyDialog({
  organizationId,
}: RetentionPolicyDialogProps) {
  const [open, setOpen] = useState(false)
  const [policies, setPolicies] = useState<RetentionPolicy[]>([
    { entity_type: '', retention_days: 365, is_active: true },
  ])
  const [newPolicy, setNewPolicy] = useState<Partial<RetentionPolicy>>({
    entity_type: '',
    retention_days: 365,
    is_active: true,
  })

  const addPolicy = () => {
    if (!newPolicy.entity_type) {
      toast.error('Please select an entity type')
      return
    }

    const exists = policies.some((p) => p.entity_type === newPolicy.entity_type)
    if (exists) {
      toast.error('Policy for this entity type already exists')
      return
    }

    setPolicies([...policies, newPolicy as RetentionPolicy])
    setNewPolicy({ entity_type: '', retention_days: 365, is_active: true })
  }

  const removePolicy = (index: number) => {
    setPolicies(policies.filter((_, i) => i !== index))
  }

  const updatePolicy = (index: number, updates: Partial<RetentionPolicy>) => {
    const updated = [...policies]
    updated[index] = { ...updated[index], ...updates }
    setPolicies(updated)
  }

  const savePolicies = async () => {
    try {
      // Here you would make API call to save policies
      toast.success('Retention policies saved successfully')
      setOpen(false)
    } catch (error) {
      toast.error('Failed to save retention policies')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Retention Policies
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Audit Log Retention Policies</DialogTitle>
          <DialogDescription>
            Configure how long audit logs are retained for each entity type.
            Logs older than the retention period will be automatically deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Policies */}
          <div>
            <h3 className="text-lg font-medium mb-4">Current Policies</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Retention Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {entityTypes.find((t) => t.value === policy.entity_type)
                        ?.label || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={policy.retention_days}
                        onChange={(e) =>
                          updatePolicy(index, {
                            retention_days: parseInt(e.target.value),
                          })
                        }
                        className="w-24"
                        min={1}
                        max={3650}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={policy.is_active ? 'default' : 'secondary'}
                      >
                        {policy.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePolicy(index)}
                        disabled={index === 0} // Don't allow removing default policy
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Add New Policy */}
          <div>
            <h3 className="text-lg font-medium mb-4">Add New Policy</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="entity-type">Entity Type</Label>
                <Select
                  value={newPolicy.entity_type}
                  onValueChange={(value) =>
                    setNewPolicy({ ...newPolicy, entity_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {entityTypes.slice(1).map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="retention-days">Retention Days</Label>
                <Input
                  id="retention-days"
                  type="number"
                  value={newPolicy.retention_days}
                  onChange={(e) =>
                    setNewPolicy({
                      ...newPolicy,
                      retention_days: parseInt(e.target.value),
                    })
                  }
                  min={1}
                  max={3650}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addPolicy}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Policy
                </Button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePolicies}>
              <Save className="mr-2 h-4 w-4" />
              Save Policies
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
