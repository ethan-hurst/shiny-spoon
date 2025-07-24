'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import Fuse from 'fuse.js'
import Link from 'next/link'
import { allHelpArticles } from 'contentlayer2/generated'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpSearch } from '@/components/help/search'
import { ArrowLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function HelpSearchPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [results, setResults] = useState<typeof allHelpArticles>([])

  // Memoize Fuse instance to avoid recreation on each render
  const fuse = useMemo(() => new Fuse(allHelpArticles, {
    keys: ['title', 'description', 'body.raw', 'keywords'],
    threshold: 0.3,
    includeScore: true,
  }), [])

  useEffect(() => {
    if (query) {
      const searchResults = fuse.search(query)
      setResults(searchResults.map((result) => result.item))
    } else {
      setResults([])
    }
  }, [query, fuse])

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <Link href="/help">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Help Center
          </Button>
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Search Results</h1>
          <HelpSearch />
        </div>

        {query && (
          <div className="mb-8">
            <p className="text-muted-foreground">
              {results.length} {results.length === 1 ? 'result' : 'results'} for "{query}"
            </p>
          </div>
        )}

        {results.length > 0 ? (
          <div className="space-y-6">
            {results.map((article) => (
              <Link key={article._id} href={article.url}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-xl hover:text-primary transition-colors">
                      {article.title}
                    </CardTitle>
                    <CardDescription>
                      {article.category} • {article.keywords.join(', ')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3">
                      {article.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : query ? (
          <Card>
            <CardContent className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground mb-6">
                Try searching with different keywords or browse our categories
              </p>
              <Link href="/help">
                <Button>Browse Help Center</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}