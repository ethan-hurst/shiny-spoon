'use client'

import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { CreateApiKeyDialog } from './create-api-key-dialog'
import { EditApiKeyDialog } from './edit-api-key-dialog'
import { ViewApiKeyDialog } from './view-api-key-dialog'
import { revokeApiKey, regenerateApiKey } from '@/app/actions/api-keys'
import { 
  Plus, 
  MoreHorizontal, 
  Key, 
  Edit, 
  RefreshCw, 
  Trash2,
  Copy,
  Eye,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface ApiKey {
  id: string
  name: string
  description?: string
  key_prefix: string
  permissions: string[]
  is_active: boolean
  created_at: string
  last_used_at?: string
  expires_at?: string
  revoked_at?: string
}

interface ApiKeysListProps {
  apiKeys: ApiKey[]
  keyLimit: number
  activeKeyCount: number
}

export function ApiKeysList({ apiKeys, keyLimit, activeKeyCount }: ApiKeysListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [viewingKey, setViewingKey] = useState<{ id: string; key?: string } | null>(null)
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null)
  const [regeneratingKeyId, setRegeneratingKeyId] = useState<string | null>(null)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ type: 'revoke' | 'regenerate'; keyId: string } | null>(null)

  const canCreateMore = keyLimit === -1 || activeKeyCount < keyLimit

  const handleRevoke = async () => {
    if (!pendingAction || pendingAction.type !== 'revoke') return

    setRevokingKeyId(pendingAction.keyId)
    try {
      await revokeApiKey(pendingAction.keyId)
      toast.success('API key revoked successfully')
    } catch (error) {
      toast.error('Failed to revoke API key')
    } finally {
      setRevokingKeyId(null)
      setActionDialogOpen(false)
      setPendingAction(null)
    }
  }

  const handleRegenerate = async () => {
    if (!pendingAction || pendingAction.type !== 'regenerate') return

    setRegeneratingKeyId(pendingAction.keyId)
    try {
      const result = await regenerateApiKey(pendingAction.keyId)
      setViewingKey({ id: result.id, key: result.key })
      toast.success('API key regenerated successfully')
    } catch (error) {
      toast.error('Failed to regenerate API key')
    } finally {
      setRegeneratingKeyId(null)
      setActionDialogOpen(false)
      setPendingAction(null)
    }
  }

  const openActionDialog = (type: 'revoke' | 'regenerate', keyId: string) => {
    setPendingAction({ type, keyId })
    setActionDialogOpen(true)
  }

  const copyKeyPrefix = (prefix: string) => {
    navigator.clipboard.writeText(`${prefix}...`)
    toast.success('Key prefix copied to clipboard')
  }

  const getPermissionBadge = (permission: string) => {
    const variants: Record<string, any> = {
      read: 'secondary',
      write: 'default',
      delete: 'destructive',
    }
    
    return (
      <Badge key={permission} variant={variants[permission] || 'outline'} className="text-xs">
        {permission}
      </Badge>
    )
  }

  const isExpired = (expiresAt?: string) => {
    return expiresAt && new Date(expiresAt) < new Date()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                {activeKeyCount} of {keyLimit === -1 ? 'unlimited' : keyLimit} keys in use
              </CardDescription>
            </div>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              disabled={!canCreateMore}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No API keys created yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Create your first API key to start using the TruthSource API
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((apiKey) => {
                    const expired = isExpired(apiKey.expires_at)
                    const isInactive = !apiKey.is_active || expired

                    return (
                      <TableRow key={apiKey.id} className={isInactive ? 'opacity-60' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{apiKey.name}</p>
                            {apiKey.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {apiKey.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {apiKey.key_prefix}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyKeyPrefix(apiKey.key_prefix)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {apiKey.permissions.map(perm => getPermissionBadge(perm))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {apiKey.last_used_at ? (
                            <span className="text-sm">
                              {formatDistanceToNow(new Date(apiKey.last_used_at), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {apiKey.revoked_at ? (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <XCircle className="h-3 w-3" />
                              Revoked
                            </Badge>
                          ) : expired ? (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Clock className="h-3 w-3" />
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <CheckCircle className="h-3 w-3" />
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
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
                                onClick={() => setEditingKey(apiKey)}
                                disabled={!apiKey.is_active}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openActionDialog('regenerate', apiKey.id)}
                                disabled={!apiKey.is_active || regeneratingKeyId === apiKey.id}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Regenerate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openActionDialog('revoke', apiKey.id)}
                                disabled={!apiKey.is_active || revokingKeyId === apiKey.id}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Revoke
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!canCreateMore && apiKeys.length > 0 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                You've reached the API key limit for your plan. 
                <a href="/portal/subscription" className="underline ml-1">Upgrade to create more</a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateApiKeyDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onSuccess={(result) => {
          setViewingKey(result)
          setCreateDialogOpen(false)
        }}
      />

      {editingKey && (
        <EditApiKeyDialog
          apiKey={editingKey}
          open={!!editingKey}
          onOpenChange={(open) => !open && setEditingKey(null)}
        />
      )}

      {viewingKey && (
        <ViewApiKeyDialog
          apiKeyId={viewingKey.id}
          apiKey={viewingKey.key}
          open={!!viewingKey}
          onOpenChange={(open) => !open && setViewingKey(null)}
        />
      )}

      <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'revoke' ? 'Revoke API Key' : 'Regenerate API Key'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'revoke' 
                ? 'Are you sure you want to revoke this API key? Any applications using this key will immediately lose access.'
                : 'Are you sure you want to regenerate this API key? The current key will be revoked and a new one will be created.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={pendingAction?.type === 'revoke' ? handleRevoke : handleRegenerate}
            >
              {pendingAction?.type === 'revoke' ? 'Revoke' : 'Regenerate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}