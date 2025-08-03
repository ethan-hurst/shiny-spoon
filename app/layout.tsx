import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import { GeistSans } from 'geist/font/sans'
import { GoogleAnalytics } from '@/components/analytics/google-analytics'
import { JsonLd } from '@/components/seo/json-ld'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import AuthWrapper from '@/components/wrapper/auth-wrapper'
import Provider from '@/app/provider'
import './globals.css'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://truthsource.io'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'TruthSource - B2B E-commerce Data Accuracy Platform',
    template: `%s | TruthSource`,
  },
  description:
    'Prevent costly B2B order errors with real-time inventory sync, dynamic pricing rules, and customer portals. Connect NetSuite, Shopify, and more.',
  keywords: [
    'B2B e-commerce',
    'inventory sync',
    'NetSuite integration',
    'Shopify integration',
    'pricing rules engine',
    'data accuracy',
    'order error prevention',
    'ERP integration',
  ],
  authors: [{ name: 'TruthSource' }],
  creator: 'TruthSource',
  publisher: 'TruthSource',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: baseUrl,
    siteName: 'TruthSource',
    title: 'TruthSource - B2B E-commerce Data Accuracy Platform',
    description:
      'Prevent costly B2B order errors with real-time inventory sync, dynamic pricing rules, and customer portals. Connect NetSuite, Shopify, and more.',
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'TruthSource - B2B E-commerce Data Accuracy Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TruthSource - B2B E-commerce Data Accuracy Platform',
    description:
      'Prevent costly B2B order errors with real-time inventory sync, dynamic pricing rules, and customer portals.',
    creator: '@truthsource',
    images: [`${baseUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthWrapper>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link
            rel="preload"
            href="https://utfs.io/f/31dba2ff-6c3b-4927-99cd-b928eaa54d5f-5w20ij.png"
            as="image"
          />
          <link
            rel="preload"
            href="https://utfs.io/f/69a12ab1-4d57-4913-90f9-38c6aca6c373-1txg2.png"
            as="image"
          />
        </head>
        <body className={GeistSans.className}>
          <Provider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </Provider>
          <JsonLd />
          {process.env.NEXT_PUBLIC_GA_ID && (
            <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
          )}
          <Analytics />
        </body>
      </html>
    </AuthWrapper>
  )
}
