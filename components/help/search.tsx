'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Fuse from 'fuse.js'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { allHelpArticles } from 'contentlayer/generated'

export function HelpSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<typeof allHelpArticles>([])

  const fuse = new Fuse(allHelpArticles, {
    keys: ['title', 'description', 'body.raw', 'keywords'],
    threshold: 0.3,
    includeScore: true,
  })

  useEffect(() => {
    if (query) {
      const searchResults = fuse.search(query)
      setResults(searchResults.map((result) => result.item))
    } else {
      setResults([])
    }
  }, [query])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/help/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search for help..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-10 pr-4 py-2 w-full"
      />
    </form>
  )
}