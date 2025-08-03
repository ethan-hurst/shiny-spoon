import Link from 'next/link'
import { allHelpArticles } from 'contentlayer2/generated'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function PopularArticles() {
  // In a real app, you'd track article views and sort by popularity
  // For now, we'll just show the first few articles
  const popularArticles = allHelpArticles.slice(0, 6)

  if (popularArticles.length === 0) {
    return null
  }

  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Popular Articles</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {popularArticles.map((article) => (
          <Link key={article._id} href={article.url}>
            <Card className="h-full hover:shadow-md transition-shadow group">
              <CardContent className="p-4">
                <h3 className="font-medium mb-1 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {article.description}
                </p>
                <div className="flex items-center gap-1 text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Read more</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
