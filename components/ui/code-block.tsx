'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  children: React.ReactNode
  className?: string
  language?: string
  filename?: string
}

export function CodeBlock({
  children,
  className,
  language,
  filename,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    if (typeof children === 'string') {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={cn('relative group', className)}>
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b rounded-t-lg">
          <span className="text-sm font-mono text-muted-foreground">
            {filename}
          </span>
          {language && (
            <span className="text-xs px-2 py-1 bg-background rounded text-muted-foreground">
              {language}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <pre
          className={cn(
            'p-4 overflow-x-auto bg-muted rounded-lg',
            filename ? 'rounded-t-none' : 'rounded-lg'
          )}
        >
          <code className="text-sm font-mono">{children}</code>
        </pre>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={copyToClipboard}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
