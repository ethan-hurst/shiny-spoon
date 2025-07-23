'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Check, Copy } from 'lucide-react'
import { generateCodeExample } from '@/lib/openapi/parser'

interface CodeExampleProps {
  endpoint: any
}

export function CodeExample({ endpoint }: CodeExampleProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null)

  const copyToClipboard = async (text: string, tab: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedTab(tab)
    setTimeout(() => setCopiedTab(null), 2000)
  }

  const languages = ['curl', 'nodejs', 'python', 'php'] as const

  return (
    <Card>
      <Tabs defaultValue="curl" className="w-full">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <TabsList className="grid grid-cols-4 w-fit">
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="nodejs">Node.js</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="php">PHP</TabsTrigger>
          </TabsList>
        </div>

        {languages.map((lang) => {
          const code = generateCodeExample(endpoint, lang)
          return (
            <TabsContent key={lang} value={lang} className="relative m-0">
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-4 top-4 h-8 w-8 p-0"
                onClick={() => copyToClipboard(code, lang)}
              >
                {copiedTab === lang ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <pre className="overflow-x-auto p-6">
                <code className="text-sm">{code}</code>
              </pre>
            </TabsContent>
          )
        })}
      </Tabs>
    </Card>
  )
}