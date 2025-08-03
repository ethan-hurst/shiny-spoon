'use client'

import { useState } from 'react'
import { AlertTriangle, Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ViewApiKeyDialogProps {
  apiKeyId: string
  apiKey?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ViewApiKeyDialog({
  apiKeyId,
  apiKey,
  open,
  onOpenChange,
}: ViewApiKeyDialogProps) {
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    if (!apiKey) return

    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      toast.success('API key copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy API key')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>API Key Created</DialogTitle>
          <DialogDescription>
            {apiKey
              ? "Your new API key has been generated. Copy it now as it won't be shown again."
              : 'API key details'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {apiKey && (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Make sure to copy your API key now. You won't be able to see
                  it again!
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <label className="text-sm font-medium">Your API Key</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      readOnly
                      className="w-full px-3 py-2 border rounded-md bg-muted font-mono text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    onClick={copyToClipboard}
                    disabled={copied}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Usage Example</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                  {`curl -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     https://api.truthsource.io/v1/products`}
                </pre>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Security Best Practices</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Store the API key securely in environment variables</li>
                  <li>Never commit API keys to version control</li>
                  <li>Rotate keys regularly</li>
                  <li>Use different keys for different environments</li>
                </ul>
              </div>
            </>
          )}

          {!apiKey && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                API key details are not available for viewing.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {apiKey ? 'Done' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
