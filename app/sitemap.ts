type SitemapEntry = {
  url: string
  lastModified: string
  changeFrequency:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'
  priority?: number
}

export default async function sitemap(): Promise<SitemapEntry[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truthsource.io'

  const staticPages: SitemapEntry[] = [
    {
      url: baseUrl,
      lastModified: new Date().toISOString(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/features/inventory-sync`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/features/pricing-rules`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/features/customer-portal`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/features/analytics`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/legal/terms`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/legal/privacy`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/legal/cookies`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]

  // Import content from Contentlayer
  const { allPosts } = await import('contentlayer/generated')
  const { allDocs } = await import('contentlayer/generated')
  const { allHelpArticles } = await import('contentlayer/generated')

  // Add blog posts
  const blogPages: SitemapEntry[] = allPosts
    .filter((post) => post.published)
    .map((post) => ({
      url: `${baseUrl}${post.url}`,
      lastModified: new Date(post.date).toISOString(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))

  // Add documentation pages
  const docPages: SitemapEntry[] = allDocs.map((doc) => ({
    url: `${baseUrl}${doc.url}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Add help articles
  const helpPages: SitemapEntry[] = allHelpArticles.map((article) => ({
    url: `${baseUrl}${article.url}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // Add docs and help landing pages
  const contentLandingPages: SitemapEntry[] = [
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  return [...staticPages, ...contentLandingPages, ...blogPages, ...docPages, ...helpPages]
}