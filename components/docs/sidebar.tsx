'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronRight, Menu, X } from 'lucide-react'
import { useState } from 'react'
import type { Doc } from 'contentlayer2/generated'

interface DocsSidebarProps {
  categories: Record<string, Doc[]>
}

export function DocsSidebar({ categories }: DocsSidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        aria-controls="docs-sidebar"
      >
        {isOpen ? <X /> : <Menu />}
      </Button>

      {/* Sidebar */}
      <aside
        id="docs-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform bg-background border-r transition-transform duration-200 ease-in-out md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Documentation navigation"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <Link href="/docs" className="font-semibold text-lg">
              Documentation
            </Link>
          </div>
          
          <ScrollArea className="flex-1 px-4 py-6">
            <nav className="space-y-6">
              {Object.entries(categories).map(([category, docs]) => (
                <div key={category}>
                  <h3 className="mb-2 px-2 text-sm font-semibold text-muted-foreground">
                    {category}
                  </h3>
                  <ul className="space-y-1">
                    {docs.map((doc) => {
                      const isActive = pathname === doc.url
                      return (
                        <li key={doc._id}>
                          <Link
                            href={doc.url}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              'group flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                              isActive && 'bg-accent text-accent-foreground font-medium'
                            )}
                          >
                            <span>{doc.title}</span>
                            <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </ScrollArea>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false)
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Close sidebar overlay"
        />
      )}
    </>
  )
}