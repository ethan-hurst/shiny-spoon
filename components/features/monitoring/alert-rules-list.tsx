// PRP-016: Data Accuracy Monitor - Alert Rules List Component
'use client'

import { useState } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertCircle,
  Bell,
  Edit,
  MoreHorizontal,
  Settings,
  Trash,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { deleteAlertRule, upsertAlertRule } from '@/app/actions/monitoring'
import { AlertConfigDialog } from './alert-config-dialog'

interface AlertRulesListProps {
  rules: any[]
  organizationId: string
}

export function AlertRulesList({ rules, organizationId }: AlertRulesListProps) {
  const { toast } = useToast()
  const [editingRule, setEditingRule] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleToggleActive = async (ruleId: string, isActive: boolean) => {
    const rule = rules.find(r => r.id === ruleId)
    if (!rule) return

    const result = await upsertAlertRule(ruleId, {
      ...rule,
      isActive: !isActive,
      severityThreshold: rule.severity_threshold,
      accuracyThreshold: rule.accuracy_threshold,
      discrepancyCountThreshold: rule.discrepancy_count_threshold,
      checkFrequency: rule.check_frequency,
      evaluationWindow: rule.evaluation_window,
      notificationChannels: rule.notification_channels,
      autoRemediate: rule.auto_remediate,
    })

    if (result.success) {
      toast({
        title: `Alert rule ${!isActive ? 'activated' : 'deactivated'}`,
      })
    } else {
      toast({
        title: 'Failed to update rule',
        description: result.error,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (ruleId: string) => {
    setDeletingId(ruleId)
    
    const result = await deleteAlertRule(ruleId)

    if (result.success) {
      toast({
        title: 'Alert rule deleted',
      })
    } else {
      toast({
        title: 'Failed to delete rule',
        description: result.error,
        variant: 'destructive',
      })
    }

    setDeletingId(null)
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return '✉️'
      case 'sms':
        return '📱'
      case 'in_app':
        return '🔔'
      case 'webhook':
        return '🔗'
      default:
        return '📢'
    }
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">No alert rules configured</h3>
        <p className="text-muted-foreground mb-4">
          Create alert rules to get notified when accuracy issues are detected
        </p>
        <AlertConfigDialog>
          <Button>
            <Bell className="h-4 w-4 mr-2" />
            Create First Alert Rule
          </Button>
        </AlertConfigDialog>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rule Name</TableHead>
            <TableHead>Conditions</TableHead>
            <TableHead>Notifications</TableHead>
            <TableHead>Auto-Remediate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{rule.name}</p>
                  {rule.description && (
                    <p className="text-sm text-muted-foreground">
                      {rule.description}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1 text-sm">
                  <div>
                    Accuracy &lt; {rule.accuracy_threshold}%
                  </div>
                  <div>
                    Discrepancies &gt; {rule.discrepancy_count_threshold}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {rule.severity_threshold} severity
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {rule.notification_channels?.map((channel: string) => (
                    <span key={channel} title={channel}>
                      {getChannelIcon(channel)}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={rule.auto_remediate ? 'default' : 'outline'}>
                  {rule.auto_remediate ? 'Enabled' : 'Disabled'}
                </Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={() => handleToggleActive(rule.id, rule.is_active)}
                />
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      disabled={deletingId === rule.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setEditingRule(rule)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Rule
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Delete Rule
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingRule && (
        <AlertConfigDialog
          rule={editingRule}
          open={!!editingRule}
          onOpenChange={(open) => !open && setEditingRule(null)}
        />
      )}
    </>
  )
}