import { generateRssFeed } from '@/lib/rss'
import { readFileSync } from 'fs'
import { NextResponse } from 'next/server'
import { createPublicRouteHandler } from '@/lib/api/route-handler'

export const GET = createPublicRouteHandler(
  async () => {
    // Generate the RSS feed
    await generateRssFeed()
    
    // Read the generated RSS file
    const rssContent = readFileSync('./public/rss.xml', 'utf-8')
    
    // Return the RSS content with appropriate headers
    return new NextResponse(rssContent, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  },
  {
    rateLimit: { requests: 60, window: '1m' }
  }
)