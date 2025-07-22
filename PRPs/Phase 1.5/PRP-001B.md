# PRP-001B: Content Management System

## Goal

Implement a flexible content management system for blog posts, documentation, help articles, and marketing content. This enables non-technical team members to create and manage content while maintaining version control and preview capabilities.

## Why This Matters

- **Content Marketing**: Regular blog posts improve SEO and establish thought leadership
- **Self-Service Support**: Help articles reduce support ticket volume
- **Documentation**: Keep docs in sync with product updates
- **Team Efficiency**: Non-developers can manage content independently
- **Version Control**: Track changes and rollback when needed

## What We're Building

A comprehensive CMS featuring:

1. MDX-based content system with frontmatter
2. Blog with categories, tags, and authors
3. Documentation portal with versioning
4. Help center with search functionality
5. Content preview system
6. RSS feed generation
7. Related content suggestions

## Context & References

### Documentation & Resources

- **MDX**: https://mdxjs.com/ - Markdown with JSX components
- **Contentlayer**: https://contentlayer.dev/ - Type-safe content
- **Fuse.js**: https://fusejs.io/ - Client-side search
- **Reading Time**: https://github.com/ngryman/reading-time
- **RSS**: https://github.com/dylang/node-rss

### Design Patterns

- **Next.js Blog Starter**: https://github.com/vercel/next.js/tree/canary/examples/blog-starter
- **Docusaurus**: https://docusaurus.io/ - Documentation best practices
- **Ghost CMS**: https://ghost.org/ - Content management UX patterns

## Implementation Blueprint

### Phase 1: Content Infrastructure

```typescript
// contentlayer.config.ts
import { defineDocumentType, makeSource } from 'contentlayer/source-files'
import readingTime from 'reading-time'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrism from 'rehype-prism-plus'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

export const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: `blog/**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    date: { type: 'date', required: true },
    published: { type: 'boolean', default: true },
    image: { type: 'string', required: true },
    authors: { type: 'list', of: { type: 'string' }, required: true },
    categories: { type: 'list', of: { type: 'string' }, required: true },
    tags: { type: 'list', of: { type: 'string' }, default: [] },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (post) =>
        `/blog/${post._raw.flattenedPath.replace('blog/', '')}`,
    },
    slug: {
      type: 'string',
      resolve: (post) => post._raw.flattenedPath.replace('blog/', ''),
    },
    readingTime: {
      type: 'json',
      resolve: (post) => readingTime(post.body.raw),
    },
  },
}))

export const Doc = defineDocumentType(() => ({
  name: 'Doc',
  filePathPattern: `docs/**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    category: { type: 'string', required: true },
    order: { type: 'number', default: 0 },
    version: { type: 'string', default: 'v1' },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (doc) => `/docs/${doc._raw.flattenedPath.replace('docs/', '')}`,
    },
    slug: {
      type: 'string',
      resolve: (doc) => doc._raw.flattenedPath.replace('docs/', ''),
    },
  },
}))

export const HelpArticle = defineDocumentType(() => ({
  name: 'HelpArticle',
  filePathPattern: `help/**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    category: { type: 'string', required: true },
    relatedArticles: { type: 'list', of: { type: 'string' }, default: [] },
    keywords: { type: 'list', of: { type: 'string' }, default: [] },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (article) =>
        `/help/${article._raw.flattenedPath.replace('help/', '')}`,
    },
  },
}))

export default makeSource({
  contentDirPath: './content',
  documentTypes: [Post, Doc, HelpArticle],
  mdx: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
      rehypePrism,
    ],
  },
})
```

### Phase 2: Blog Implementation

```typescript
// app/blog/page.tsx
import { allPosts } from 'contentlayer/generated'
import { compareDesc } from 'date-fns'
import { BlogCard } from '@/components/blog/blog-card'
import { BlogFilters } from '@/components/blog/blog-filters'
import { Pagination } from '@/components/ui/pagination'
import { generateRssFeed } from '@/lib/rss'

export const metadata = {
  title: 'Blog - TruthSource',
  description: 'Insights on B2B e-commerce, inventory management, and data accuracy.',
}

const POSTS_PER_PAGE = 12

export default async function BlogPage({
  searchParams,
}: {
  searchParams: { page?: string; category?: string; tag?: string }
}) {
  // Generate RSS feed on each build
  await generateRssFeed()

  const currentPage = Number(searchParams.page) || 1
  const selectedCategory = searchParams.category
  const selectedTag = searchParams.tag

  // Filter and sort posts
  let filteredPosts = allPosts
    .filter((post) => post.published)
    .sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))

  if (selectedCategory) {
    filteredPosts = filteredPosts.filter((post) =>
      post.categories.includes(selectedCategory)
    )
  }

  if (selectedTag) {
    filteredPosts = filteredPosts.filter((post) =>
      post.tags.includes(selectedTag)
    )
  }

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE
  const endIndex = startIndex + POSTS_PER_PAGE
  const currentPosts = filteredPosts.slice(startIndex, endIndex)

  // Get all categories and tags for filters
  const allCategories = [...new Set(allPosts.flatMap((post) => post.categories))]
  const allTags = [...new Set(allPosts.flatMap((post) => post.tags))]

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-muted-foreground">
            Insights and updates from the TruthSource team
          </p>
        </div>

        <BlogFilters
          categories={allCategories}
          tags={allTags}
          selectedCategory={selectedCategory}
          selectedTag={selectedTag}
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {currentPosts.map((post) => (
            <BlogCard key={post._id} post={post} />
          ))}
        </div>

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl="/blog"
          />
        )}
      </div>
    </div>
  )
}
```

### Phase 3: Blog Post Page

```typescript
// app/blog/[...slug]/page.tsx
import { notFound } from 'next/navigation'
import { allPosts } from 'contentlayer/generated'
import { getMDXComponent } from 'next-contentlayer/hooks'
import { format } from 'date-fns'
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

export async function generateMetadata({ params }: { params: { slug: string[] } }) {
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

export default function BlogPost({ params }: { params: { slug: string[] } }) {
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
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-auto rounded-lg mb-8"
        />

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
```

### Phase 4: Documentation Portal

```typescript
// app/docs/layout.tsx
import { allDocs } from 'contentlayer/generated'
import { DocsSidebar } from '@/components/docs/sidebar'
import { DocsSearch } from '@/components/docs/search'
import { VersionSelector } from '@/components/docs/version-selector'

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const docsByCategory = allDocs.reduce((acc, doc) => {
    const category = doc.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(doc)
    return acc
  }, {} as Record<string, typeof allDocs>)

  // Sort docs within each category by order
  Object.keys(docsByCategory).forEach((category) => {
    docsByCategory[category].sort((a, b) => a.order - b.order)
  })

  return (
    <div className="flex min-h-screen">
      <DocsSidebar categories={docsByCategory} />
      <div className="flex-1 px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <DocsSearch />
            <VersionSelector />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
```

### Phase 5: Help Center

```typescript
// app/help/page.tsx
import { allHelpArticles } from 'contentlayer/generated'
import { HelpSearch } from '@/components/help/search'
import { HelpCategories } from '@/components/help/categories'
import { PopularArticles } from '@/components/help/popular-articles'
import { ContactSupport } from '@/components/help/contact-support'

export default function HelpCenterPage() {
  const articlesByCategory = allHelpArticles.reduce((acc, article) => {
    const category = article.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(article)
    return acc
  }, {} as Record<string, typeof allHelpArticles>)

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">How can we help?</h1>
          <HelpSearch />
        </div>

        <PopularArticles />
        <HelpCategories categories={articlesByCategory} />
        <ContactSupport />
      </div>
    </div>
  )
}
```

### Phase 6: Content Search

```typescript
// components/help/search.tsx
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
```

### Phase 7: RSS Feed Generation

```typescript
// lib/rss.ts
import { writeFileSync } from 'fs'
import { allPosts } from 'contentlayer/generated'
import RSS from 'rss'

export async function generateRssFeed() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truthsource.io'

  const feed = new RSS({
    title: 'TruthSource Blog',
    description:
      'Insights on B2B e-commerce, inventory management, and data accuracy',
    feed_url: `${siteUrl}/rss.xml`,
    site_url: siteUrl,
    image_url: `${siteUrl}/logo.png`,
    language: 'en',
    pubDate: new Date().toISOString(),
  })

  allPosts
    .filter((post) => post.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20) // Latest 20 posts
    .forEach((post) => {
      feed.item({
        title: post.title,
        description: post.description,
        url: `${siteUrl}${post.url}`,
        date: new Date(post.date),
        categories: post.categories,
        author: post.authors.join(', '),
      })
    })

  writeFileSync('./public/rss.xml', feed.xml({ indent: true }))
}
```

## Validation Requirements

### Level 0: Content Structure

- [ ] MDX files compile without errors
- [ ] All frontmatter fields validated
- [ ] Images referenced exist
- [ ] Internal links work

### Level 1: Feature Functionality

- [ ] Blog posts render correctly
- [ ] Documentation navigation works
- [ ] Help search returns relevant results
- [ ] RSS feed generates valid XML
- [ ] Related content shows

### Level 2: Performance

- [ ] Search results appear < 200ms
- [ ] MDX compilation cached properly
- [ ] Images lazy loaded
- [ ] Static generation for all content

### Level 3: SEO & Discovery

- [ ] All pages have unique meta tags
- [ ] Sitemap includes all content
- [ ] Schema markup for articles
- [ ] Reading time calculated
- [ ] Social sharing images work

### Level 4: Editorial Workflow

- [ ] Preview unpublished content
- [ ] Draft posts not visible publicly
- [ ] Version control for all content
- [ ] Author profiles linked
- [ ] Categories and tags consistent

## Files to Create/Modify

```yaml
CREATE:
  - contentlayer.config.ts # Content configuration
  - content/blog/**/*.mdx # Blog posts
  - content/docs/**/*.mdx # Documentation
  - content/help/**/*.mdx # Help articles
  - content/authors/*.json # Author profiles
  - app/blog/page.tsx # Blog listing
  - app/blog/[...slug]/page.tsx # Blog post page
  - app/docs/layout.tsx # Docs layout
  - app/docs/[...slug]/page.tsx # Doc page
  - app/help/page.tsx # Help center
  - app/help/[...slug]/page.tsx # Help article
  - app/help/search/page.tsx # Search results
  - components/blog/* # Blog components
  - components/docs/* # Docs components
  - components/help/* # Help components
  - components/mdx/* # MDX components
  - lib/rss.ts # RSS generation
  - public/rss.xml # Generated RSS

MODIFY:
  - package.json # Add contentlayer deps
  - next.config.js # Add contentlayer plugin
  - app/sitemap.ts # Include content pages
```

## Success Metrics

- [ ] Blog posts published and indexed
- [ ] Documentation searchable
- [ ] Help articles reduce support tickets
- [ ] RSS subscribers growing
- [ ] Content shared on social media
- [ ] Low bounce rate on content pages
- [ ] High search relevance scores

## Dependencies

- PRP-001: Next.js setup ✅
- PRP-001A: Public website (for navigation)

## Notes

- Consider adding commenting system later
- Plan for content translation
- Set up content approval workflow
- Monitor popular search queries
- A/B test different content formats
