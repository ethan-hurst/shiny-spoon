import { notFound } from 'next/navigation'
import { allPosts } from 'contentlayer/generated'
import { getMDXComponent } from 'next-contentlayer/hooks'
import { format } from 'date-fns'
import Image from 'next/image'
import { BlogAuthor } from '@/components/blog/blog-author'
import { ShareButtons } from '@/components/blog/share-buttons'
import { RelatedPosts } from '@/components/blog/related-posts'
import { NewsletterCTA } from '@/components/marketing/newsletter-cta'
import { MDXComponents } from '@/components/mdx'

export async function generateStaticParams() {
  return allPosts.map((post) => ({
    slug: post.slug.split('/'),
  }))
}

export async function generateMetadata(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params
  const post = allPosts.find((post) => post.slug === params.slug.join('/'))
  if (!post) return {}

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: post.authors,
      images: [post.image],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [post.image],
    },
  }
}

export default async function BlogPost(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params
  const post = allPosts.find((post) => post.slug === params.slug.join('/'))

  if (!post || !post.published) {
    notFound()
  }

  const MDXContent = getMDXComponent(post.body.code)

  return (
    <article className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <time dateTime={post.date}>
              {format(new Date(post.date), 'MMMM d, yyyy')}
            </time>
            <span>•</span>
            <span>{post.readingTime.text}</span>
          </div>

          <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
          <p className="text-xl text-muted-foreground mb-8">{post.description}</p>

          <div className="flex items-center justify-between">
            <BlogAuthor authors={post.authors} />
            <ShareButtons url={post.url} title={post.title} />
          </div>
        </header>

        {/* Featured Image */}
        <div className="relative w-full aspect-video mb-8">
          <Image
            src={post.image}
            alt={post.title}
            fill
            className="object-cover rounded-lg"
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
          />
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none dark:prose-invert">
          <MDXContent components={MDXComponents} />
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t">
          <NewsletterCTA />
          <RelatedPosts currentPost={post} />
        </footer>
      </div>
    </article>
  )
}