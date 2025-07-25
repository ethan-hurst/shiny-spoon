import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { allPosts } from 'contentlayer2/generated'
// @ts-ignore - RSS library types not available
import RSS from 'rss'
import path from 'path'

export async function generateRssFeed() {
  try {
    // Validate and get site URL
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truthsource.io'
    
    // Validate URL format
    try {
      new URL(siteUrl)
    } catch (error) {
      throw new Error(`Invalid site URL: ${siteUrl}`)
    }

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

    // Filter and validate posts
    const validPosts = allPosts
      .filter((post) => {
        // Validate required fields
        if (!post.published) return false
        if (!post.date || !post.title || !post.description || !post.url) {
          console.warn(`Skipping invalid post: ${post._id}`)
          return false
        }
        
        // Validate date
        try {
          new Date(post.date)
          return true
        } catch {
          console.warn(`Invalid date for post: ${post._id}`)
          return false
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20) // Latest 20 posts

    validPosts.forEach((post) => {
      try {
        feed.item({
          title: post.title,
          description: post.description,
          url: `${siteUrl}${post.url}`,
          date: new Date(post.date),
          categories: post.categories || [],
          author: (post.authors || []).join(', '),
        })
      } catch (error) {
        console.error(`Failed to add post to RSS feed: ${post._id}`, error)
      }
    })

    // Ensure public directory exists
    const publicDir = path.join(process.cwd(), 'public')
    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true })
    }

    // Write RSS feed
    try {
      writeFileSync(path.join(publicDir, 'rss.xml'), feed.xml({ indent: true }))
      console.log('RSS feed generated successfully')
    } catch (error) {
      throw new Error(`Failed to write RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Failed to generate RSS feed:', error)
    throw error
  }
}