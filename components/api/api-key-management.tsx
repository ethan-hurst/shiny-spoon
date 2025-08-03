'use client'

import { useState, useEffect } from 'react'
import { Plus, Copy, Trash2, Eye, EyeOff, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiKey, ApiScope, ApiTier } from '@/lib/api/types'
import { createApiKey, getApiKeys, deleteApiKey, regenerateApiKey } from '@/lib/actions/api-keys'
import { format } from 'date-fns'

// Scope descriptions
const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  [ApiScope.READ_PRODUCTS]: 'Read product information',
  [ApiScope.READ_INVENTORY]: 'Read inventory data',
  [ApiScope.READ_ORDERS]: 'Read order information',
  [ApiScope.READ_WAREHOUSES]: 'Read warehouse data',
  [ApiScope.READ_REPORTS]: 'Read reports and analytics',
  [ApiScope.READ_ANALYTICS]: 'Read analytics data',
  [ApiScope.WRITE_PRODUCTS]: 'Create and update products',
  [ApiScope.WRITE_INVENTORY]: 'Update inventory levels',
  [ApiScope.WRITE_ORDERS]: 'Create and update orders',
  [ApiScope.WRITE_WAREHOUSES]: 'Manage warehouses',
  [ApiScope.ADMIN_WEBHOOKS]: 'Manage webhook subscriptions',
  [ApiScope.ADMIN_API_KEYS]: 'Manage API keys',
  [ApiScope.ADMIN_ALL]: 'Full administrative access'
}

// Tier descriptions
const TIER_DESCRIPTIONS: Record<ApiTier, { name: string; limits: string }> = {
  [ApiTier.BASIC]: {
    name: 'Basic',
    limits: '100 requests/hour, 10 concurrent'
  },
  [ApiTier.PRO]: {
    name: 'Pro',
    limits: '1,000 requests/hour, 50 concurrent'
  },
  [ApiTier.ENTERPRISE]: {
    name: 'Enterprise',
    limits: '10,000 requests/hour, 100 concurrent'
  }
}

export function ApiKeyManagement() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showKey, setShowKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [tier, setTier] = useState<ApiTier>(ApiTier.BASIC)
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>([])
  const [ipWhitelist, setIpWhitelist] = useState('')
  const [expiresIn, setExpiresIn] = useState('never')
  
  // Load API keys
  const loadApiKeys = async () => {
    setLoading(true)
    try {
      const keys = await getApiKeys()
      setApiKeys(keys)
    } catch (error) {
      console.error('Failed to load API keys:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Create new API key
  const handleCreateApiKey = async () => {
    try {
      const expiresAt = expiresIn === 'never' 
        ? undefined 
        : new Date(Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000)
      
      const ips = ipWhitelist
        .split(',')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0)
      
      const { key } = await createApiKey({
        name,
        tier,
        scopes: selectedScopes,
        ipWhitelist: ips,
        expiresAt
      })
      
      setShowKey(key)
      await loadApiKeys()
      resetForm()
    } catch (error) {
      console.error('Failed to create API key:', error)
    }
  }
  
  // Delete API key
  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return
    
    try {
      await deleteApiKey(id)
      await loadApiKeys()
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
  }
  
  // Copy API key
  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }
  
  // Reset form
  const resetForm = () => {
    setName('')
    setTier(ApiTier.BASIC)
    setSelectedScopes([])
    setIpWhitelist('')
    setExpiresIn('never')
  }
  
  // Toggle scope selection
  const toggleScope = (scope: ApiScope) => {
    setSelectedScopes(prev =>
      prev.includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    )
  }
  
  // Load keys on mount
  useEffect(() => {
    loadApiKeys()
  }, [])
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for external integrations
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key with specific permissions
                  </DialogDescription>
                </DialogHeader>
                
                {showKey ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                      <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                        Save this API key now. You won't be able to see it again!
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          value={showKey}
                          readOnly
                          className="font-mono"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyApiKey(showKey)}
                        >
                          {copiedKey === showKey ? (
                            'Copied!'
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setShowCreateDialog(false)
                        setShowKey(null)
                      }}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Production API Key"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="tier">Tier</Label>
                      <Select value={tier} onValueChange={(v) => setTier(v as ApiTier)}>
                        <SelectTrigger id="tier">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIER_DESCRIPTIONS).map(([key, desc]) => (
                            <SelectItem key={key} value={key}>
                              <div>
                                <div className="font-medium">{desc.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {desc.limits}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Scopes</Label>
                      <div className="space-y-3 mt-2">
                        <div>
                          <p className="text-sm font-medium mb-2">Read Permissions</p>
                          <div className="space-y-2">
                            {Object.entries(SCOPE_DESCRIPTIONS)
                              .filter(([key]) => key.startsWith('read:'))
                              .map(([key, desc]) => (
                                <div key={key} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={key}
                                    checked={selectedScopes.includes(key as ApiScope)}
                                    onCheckedChange={() => toggleScope(key as ApiScope)}
                                  />
                                  <Label
                                    htmlFor={key}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {desc}
                                  </Label>
                                </div>
                              ))}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium mb-2">Write Permissions</p>
                          <div className="space-y-2">
                            {Object.entries(SCOPE_DESCRIPTIONS)
                              .filter(([key]) => key.startsWith('write:'))
                              .map(([key, desc]) => (
                                <div key={key} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={key}
                                    checked={selectedScopes.includes(key as ApiScope)}
                                    onCheckedChange={() => toggleScope(key as ApiScope)}
                                  />
                                  <Label
                                    htmlFor={key}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {desc}
                                  </Label>
                                </div>
                              ))}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium mb-2">Admin Permissions</p>
                          <div className="space-y-2">
                            {Object.entries(SCOPE_DESCRIPTIONS)
                              .filter(([key]) => key.startsWith('admin:'))
                              .map(([key, desc]) => (
                                <div key={key} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={key}
                                    checked={selectedScopes.includes(key as ApiScope)}
                                    onCheckedChange={() => toggleScope(key as ApiScope)}
                                  />
                                  <Label
                                    htmlFor={key}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {desc}
                                  </Label>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="ip-whitelist">IP Whitelist (optional)</Label>
                      <Input
                        id="ip-whitelist"
                        value={ipWhitelist}
                        onChange={(e) => setIpWhitelist(e.target.value)}
                        placeholder="192.168.1.1, 10.0.0.0/24"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Comma-separated list of allowed IP addresses
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="expires">Expires</Label>
                      <Select value={expiresIn} onValueChange={setExpiresIn}>
                        <SelectTrigger id="expires">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCreateDialog(false)
                          resetForm()
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateApiKey}
                        disabled={!name || selectedScopes.length === 0}
                      >
                        Create API Key
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell className="font-medium">{apiKey.name}</TableCell>
                  <TableCell>
                    <code className="text-xs">
                      {apiKey.key.substring(0, 8)}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TIER_DESCRIPTIONS[apiKey.tier].name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {apiKey.scopes.length} scopes
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {apiKey.lastUsedAt
                      ? format(apiKey.lastUsedAt, 'MMM d, yyyy')
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    {apiKey.expiresAt
                      ? format(apiKey.expiresAt, 'MMM d, yyyy')
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteApiKey(apiKey.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}