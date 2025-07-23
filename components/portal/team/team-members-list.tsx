'use client'

import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { InviteTeamMemberDialog } from './invite-team-member-dialog'
import { EditMemberRoleDialog } from './edit-member-role-dialog'
import { updateTeamMember, removeTeamMember } from '@/app/actions/team'
import { TEAM_ROLES } from '@/lib/constants/team'
import { 
  Plus, 
  MoreHorizontal, 
  Shield, 
  User, 
  Eye, 
  UserMinus,
  Mail,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'

interface TeamMember {
  user_id: string
  role: string
  created_at: string
  auth?: {
    users?: {
      email?: string
      created_at?: string
      last_sign_in_at?: string
    }
  }
}

interface TeamMembersListProps {
  members: TeamMember[]
  currentUserId: string
  isAdmin: boolean
  canInviteMore: boolean
  teamLimit: number
}

export function TeamMembersList({ 
  members, 
  currentUserId, 
  isAdmin, 
  canInviteMore,
  teamLimit 
}: TeamMembersListProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)

  const handleRemove = async () => {
    if (!removingMemberId) return

    const formData = new FormData()
    formData.append('userId', removingMemberId)

    try {
      await removeTeamMember(formData)
      toast.success('Team member removed successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove team member')
    } finally {
      setRemovingMemberId(null)
      setRemoveDialogOpen(false)
    }
  }

  const openRemoveDialog = (memberId: string) => {
    setRemovingMemberId(memberId)
    setRemoveDialogOpen(true)
  }

  const getRoleBadge = (role: string) => {
    const config = {
      [TEAM_ROLES.ADMIN.value]: { icon: Shield, label: TEAM_ROLES.ADMIN.label, variant: 'default' as const },
      [TEAM_ROLES.MEMBER.value]: { icon: User, label: TEAM_ROLES.MEMBER.label, variant: 'secondary' as const },
      [TEAM_ROLES.VIEWER.value]: { icon: Eye, label: TEAM_ROLES.VIEWER.label, variant: 'outline' as const },
    }

    const roleConfig = config[role as keyof typeof config] || config[TEAM_ROLES.MEMBER.value]
    const Icon = roleConfig.icon

    return (
      <Badge variant={roleConfig.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {roleConfig.label}
      </Badge>
    )
  }

  const getInitials = (email?: string) => {
    if (!email) return '??'
    return email.split('@')[0].slice(0, 2).toUpperCase()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {members.length} of {teamLimit} team members
              </CardDescription>
            </div>
            {isAdmin && (
              <Button 
                onClick={() => setInviteDialogOpen(true)}
                disabled={!canInviteMore}
              >
                <Plus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Active</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const email = member.auth?.users?.email || 'Unknown'
                  const isCurrentUser = member.user_id === currentUserId

                  return (
                    <TableRow key={member.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://avatar.vercel.sh/${email}`} />
                            <AvatarFallback>{getInitials(email)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {email}
                              {isCurrentUser && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(member.role)}</TableCell>
                      <TableCell>
                        {member.auth?.users?.created_at ? (
                          <span className="text-sm">
                            {format(new Date(member.auth.users.created_at), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.auth?.users?.last_sign_in_at ? (
                          <span className="text-sm">
                            {formatDistanceToNow(new Date(member.auth.users.last_sign_in_at), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {!isCurrentUser && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setEditingMember(member)}
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Change Role
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openRemoveDialog(member.user_id)}
                                  className="text-destructive"
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Remove from Team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {!canInviteMore && isAdmin && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                You've reached the team member limit for your plan. 
                <a href="/portal/subscription" className="underline ml-1">Upgrade to invite more</a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <InviteTeamMemberDialog 
            open={inviteDialogOpen} 
            onOpenChange={setInviteDialogOpen}
          />

          {editingMember && (
            <EditMemberRoleDialog
              member={editingMember}
              open={!!editingMember}
              onOpenChange={(open) => !open && setEditingMember(null)}
            />
          )}

          <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove this member from your team? They will immediately lose access to your organization's data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  )
}