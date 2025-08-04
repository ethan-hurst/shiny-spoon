// const { withContentlayer } = require('next-contentlayer2')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed deprecated serverExternalPackages - now handled automatically by Next.js
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'seo-heist.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ansubkhan.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Disable Edge Runtime for problematic routes
  async headers() {
    return [
      {
        source: '/api/webhooks/:path*',
        headers: [
          {
            key: 'x-runtime',
            value: 'nodejs',
          },
        ],
      },
      {
        source: '/api/monitoring/:path*',
        headers: [
          {
            key: 'x-runtime',
            value: 'nodejs',
          },
        ],
      },
    ]
  },
  // Turbopack configuration (stable in Next.js 15)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // Performance optimizations
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
}

// module.exports = withContentlayer(nextConfig)
module.exports = nextConfig
