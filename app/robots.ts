import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truthsource.io'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/admin/',
          '/settings/',
          '/_next/',
          '/private/',
          '/*.json$',
          '/*?*', // URLs with query parameters
          '/auth/',
          '/reset-password/',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
