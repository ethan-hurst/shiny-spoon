import { notFound } from 'next/navigation'
import { allHelpArticles } from 'contentlayer2/generated'
import { getMDXComponent } from 'next-contentlayer2/hooks'
import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MDXComponents } from '@/components/mdx'
import { RelatedArticles } from '@/components/help/related-articles'
import { ArticleFeedback } from '@/components/help/article-feedback'

export async function generateStaticParams() {
  return allHelpArticles.map((article) => ({
    slug: article.slug.split('/'),
  }))
}

export async function generateMetadata(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params
  const article = allHelpArticles.find(
    (article) => article.slug === params.slug.join('/')
  )
  if (!article) return {}

  return {
    title: `${article.title} - TruthSource Help`,
    description: article.description,
  }
}

export default async function HelpArticlePage(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params
  const article = allHelpArticles.find(
    (article) => article.slug === params.slug.join('/')
  )

  if (!article) {
    notFound()
  }

  const MDXContent = getMDXComponent(article.body.code)

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <Link href="/help">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Help Center
          </Button>
        </Link>

        <article>
          <header className="mb-8">
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1">
                {article.category}
              </span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{article.readingTime.text}</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
            <p className="text-lg text-muted-foreground">{article.description}</p>
          </header>

          <div className="prose prose-gray max-w-none dark:prose-invert">
            <MDXContent components={MDXComponents} />
          </div>

          <div className="mt-12 pt-8 border-t space-y-12">
            <ArticleFeedback articleId={article._id} />
            <RelatedArticles
              currentArticle={article}
              relatedSlugs={article.relatedArticles}
            />
          </div>
        </article>
      </div>
    </div>
  )
}