const { withContentlayer } = require('next-contentlayer2')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Optimize production builds
  swcMinify: true,
  
  // Experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: [
      '@tremor/react',
      'lucide-react',
      'date-fns',
      '@tanstack/react-table',
      'recharts',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
    ],
    
    // Enable partial prerendering (experimental)
    ppr: true,
    
    // Optimize server components
    serverComponentsExternalPackages: ['@tremor/react'],
  },

  // Image optimization settings
  images: {
    // Enable AVIF format for better compression
    formats: ['image/avif', 'image/webp'],
    
    // Define device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    
    // Minimize image processing
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    
    // Remote patterns for external images
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

  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      // Cache static assets
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=31536000',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=31536000',
          },
        ],
      },
      // Cache API responses
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
    ]
  },

  // Webpack optimization
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      // Optimize chunks
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          
          // Framework chunk
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-sync-external-store)[\\/]/,
            priority: 40,
            enforce: true,
          },
          
          // Library chunk
          lib: {
            test(module) {
              return module.size() > 160000 &&
                /node_modules[/\\]/.test(module.identifier())
            },
            name(module) {
              const hash = crypto.createHash('sha1')
              hash.update(module.identifier())
              return hash.digest('hex').substring(0, 8)
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          
          // Commons chunk
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
            priority: 20,
          },
          
          // Shared chunk
          shared: {
            name(module, chunks) {
              return crypto
                .createHash('sha1')
                .update(chunks.reduce((acc, chunk) => acc + chunk.name, ''))
                .digest('hex')
                .substring(0, 8)
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
        
        // Limit the maximum number of requests
        maxAsyncRequests: 30,
        maxInitialRequests: 25,
      }
      
      // Minimize bundle size
      config.optimization.minimize = true
      
      // Use deterministic module ids for long term caching
      config.optimization.moduleIds = 'deterministic'
    }

    return config
  },

  // Enable build caching
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // Disable in-memory caching in favor of file-system
}

// Apply bundle analyzer if enabled
module.exports = withBundleAnalyzer(withContentlayer(nextConfig))