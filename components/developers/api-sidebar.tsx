'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ApiSidebarProps {
  endpoints: Record<string, any[]>
  tags?: Array<{
    name: string
    description?: string
  }>
}

export function ApiSidebar({ endpoints, tags = [] }: ApiSidebarProps) {
  const pathname = usePathname()
  const [expandedTags, setExpandedTags] = useState<string[]>(
    Object.keys(endpoints)
  )

  const toggleTag = (tag: string) => {
    setExpandedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    )
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'text-blue-600 dark:text-blue-400'
      case 'POST':
        return 'text-green-600 dark:text-green-400'
      case 'PUT':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'PATCH':
        return 'text-orange-600 dark:text-orange-400'
      case 'DELETE':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <aside className="sticky top-20 h-[calc(100vh-5rem)] w-full overflow-hidden">
      <ScrollArea className="h-full py-6 pr-6 lg:py-8">
        <div className="space-y-4">
          <div className="mb-4">
            <h3 className="mb-2 text-lg font-semibold">API Reference</h3>
            <p className="text-sm text-muted-foreground">
              Explore all available endpoints
            </p>
          </div>

          {Object.entries(endpoints).map(([tag, tagEndpoints]) => {
            const tagInfo = tags.find((t) => t.name === tag)
            const isExpanded = expandedTags.includes(tag)

            return (
              <div key={tag} className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-medium"
                  onClick={() => toggleTag(tag)}
                >
                  <ChevronRight
                    className={cn(
                      'mr-1 h-4 w-4 transition-transform',
                      isExpanded && 'rotate-90'
                    )}
                  />
                  {tag}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {tagEndpoints.length}
                  </span>
                </Button>

                {isExpanded && (
                  <div className="ml-4 space-y-1 border-l pl-4">
                    {tagInfo?.description && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        {tagInfo.description}
                      </p>
                    )}
                    {tagEndpoints.map((endpoint) => {
                      const slug = endpoint.operationId
                      const isActive = pathname === `/developers/docs/${slug}`

                      return (
                        <Link
                          key={`${endpoint.method}-${endpoint.path}`}
                          href={`/developers/docs/${slug}`}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                            isActive && 'bg-accent font-medium text-accent-foreground'
                          )}
                        >
                          <span
                            className={cn(
                              'text-xs font-semibold',
                              getMethodColor(endpoint.method)
                            )}
                          >
                            {endpoint.method}
                          </span>
                          <span className="truncate">{endpoint.path}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </aside>
  )
}