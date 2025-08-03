'use client'

import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Clock, Eye, Mail, RefreshCw, Shield, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TEAM_ROLES } from '@/lib/constants/team'
import { cancelInvitation, resendInvitation } from '@/app/actions/team'

interface TeamInvite {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
  message?: string
}

interface PendingInvitesProps {
  invites: TeamInvite[]
}

export function PendingInvites({ invites }: PendingInvitesProps) {
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const handleResend = async (inviteId: string) => {
    setResendingId(inviteId)
    try {
      await resendInvitation(inviteId)
      toast.success('Invitation resent successfully')
    } catch (error) {
      toast.error('Failed to resend invitation')
    } finally {
      setResendingId(null)
    }
  }

  const handleCancel = async (inviteId: string) => {
    setCancelingId(inviteId)
    try {
      await cancelInvitation(inviteId)
      toast.success('Invitation canceled')
    } catch (error) {
      toast.error('Failed to cancel invitation')
    } finally {
      setCancelingId(null)
    }
  }

  const getRoleBadge = (role: string) => {
    const config = {
      [TEAM_ROLES.ADMIN.value]: {
        icon: Shield,
        label: TEAM_ROLES.ADMIN.label,
        variant: 'default' as const,
      },
      [TEAM_ROLES.MEMBER.value]: {
        icon: User,
        label: TEAM_ROLES.MEMBER.label,
        variant: 'secondary' as const,
      },
      [TEAM_ROLES.VIEWER.value]: {
        icon: Eye,
        label: TEAM_ROLES.VIEWER.label,
        variant: 'outline' as const,
      },
    }

    const roleConfig =
      config[role as keyof typeof config] || config[TEAM_ROLES.MEMBER.value]
    const Icon = roleConfig.icon

    return (
      <Badge variant={roleConfig.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {roleConfig.label}
      </Badge>
    )
  }

  const isExpiringSoon = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt)
    const daysUntilExpiry =
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntilExpiry <= 2
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
        <CardDescription>
          Team invitations that haven't been accepted yet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => {
                const expiringSoon = isExpiringSoon(invite.expires_at)

                return (
                  <TableRow key={invite.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{invite.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(invite.role)}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(invite.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {expiringSoon && (
                          <Clock className="h-3 w-3 text-amber-500" />
                        )}
                        <span
                          className={`text-sm ${expiringSoon ? 'text-amber-600 dark:text-amber-500' : ''}`}
                        >
                          {format(new Date(invite.expires_at), 'MMM d')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResend(invite.id)}
                          disabled={resendingId === invite.id}
                        >
                          {resendingId === invite.id ? (
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(invite.id)}
                          disabled={cancelingId === invite.id}
                          className="text-destructive"
                        >
                          {cancelingId === invite.id ? (
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {invites.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No pending invitations
          </p>
        )}
      </CardContent>
    </Card>
  )
}
