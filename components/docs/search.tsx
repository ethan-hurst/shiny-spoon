'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Fuse from 'fuse.js'
import { Search } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { allDocs } from 'contentlayer2/generated'
import { Button } from '@/components/ui/button'

/**
 * Renders a searchable documentation command dialog with fuzzy search and keyboard shortcut support.
 *
 * Provides an interactive interface for searching and navigating documentation pages using fuzzy matching on titles, descriptions, and content. Users can open the dialog with a button or the Cmd+K/Ctrl+K keyboard shortcut, enter a query, and select from up to five matching results to navigate directly to the chosen document.
 */
export function DocsSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<typeof allDocs>([])

  const fuse = useMemo(() => new Fuse(allDocs, {
    keys: ['title', 'description', 'body.raw'],
    threshold: 0.3,
    includeScore: true,
  }), [])

  useEffect(() => {
    if (query) {
      const searchResults = fuse.search(query)
      setResults(searchResults.slice(0, 5).map((result) => result.item))
    } else {
      setResults([])
    }
  }, [query, fuse])

  const handleSelect = useCallback((url: string) => {
    setOpen(false)
    setQuery('')
    router.push(url)
  }, [router])

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        className="relative w-full max-w-sm justify-start text-sm text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        Search documentation...
        <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search documentation..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {results.length > 0 && (
            <CommandGroup heading="Documentation">
              {results.map((doc) => (
                <CommandItem
                  key={doc._id}
                  value={doc.url}
                  onSelect={() => handleSelect(doc.url)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{doc.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {doc.category} • {doc.description.slice(0, 50)}...
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}