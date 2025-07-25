import Link from 'next/link'
import { allHelpArticles, type HelpArticle } from 'contentlayer2/generated'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'

interface RelatedArticlesProps {
  currentArticle: HelpArticle
  relatedSlugs: string[]
}

export function RelatedArticles({ currentArticle, relatedSlugs }: RelatedArticlesProps) {
  // Get related articles by slug
  let relatedArticles = allHelpArticles.filter((article) =>
    relatedSlugs.includes(article.slug)
  )

  // If no manually specified related articles, find articles in the same category
  if (relatedArticles.length === 0) {
    relatedArticles = allHelpArticles
      .filter(
        (article) =>
          article.category === currentArticle.category &&
          article._id !== currentArticle._id
      )
      .slice(0, 3)
  }

  if (relatedArticles.length === 0) {
    return null
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
      <div className="grid gap-4">
        {relatedArticles.map((article) => (
          <Link key={article._id} href={article.url}>
            <Card className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-2">
                  {article.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}