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