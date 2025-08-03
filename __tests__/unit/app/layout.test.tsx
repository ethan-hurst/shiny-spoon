import { Metadata } from 'next'
import { render, screen } from '@testing-library/react'
import RootLayout, { metadata } from '@/app/layout'

// Mock components to focus on layout behavior
jest.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}))

jest.mock('@/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

jest.mock('@/components/wrapper/auth-wrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-wrapper">{children}</div>
  ),
}))

jest.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => <div data-testid="json-ld" />,
}))

jest.mock('@/components/analytics/google-analytics', () => ({
  GoogleAnalytics: () => <div data-testid="google-analytics" />,
}))

jest.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}))

describe('RootLayout', () => {
  it('should render with proper structure', () => {
    render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>
    )

    // Check for essential components
    expect(screen.getByTestId('auth-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
    expect(screen.getByTestId('toaster')).toBeInTheDocument()
    expect(screen.getByTestId('json-ld')).toBeInTheDocument()
  })

  it('should render children content', () => {
    render(
      <RootLayout>
        <div data-testid="test-content">Test content</div>
      </RootLayout>
    )

    expect(screen.getByTestId('test-content')).toBeInTheDocument()
  })

  it('should have proper metadata structure', () => {
    // Validate metadata has required fields
    expect(metadata).toHaveProperty('title')
    expect(metadata).toHaveProperty('description')
    expect(metadata).toHaveProperty('keywords')
    expect(metadata).toHaveProperty('openGraph')
    expect(metadata).toHaveProperty('twitter')
    expect(metadata).toHaveProperty('robots')
  })

  it('should have correct metadata types', () => {
    // Type safety test
    const typedMetadata: Metadata = metadata
    expect(typedMetadata.title).toBeDefined()
    expect(typedMetadata.description).toBeDefined()
  })

  it('should include TruthSource branding in metadata', () => {
    // Check if title contains TruthSource (handle both string and object cases)
    const title = metadata.title
    if (typeof title === 'string') {
      expect(title).toContain('TruthSource')
    } else if (title && typeof title === 'object' && 'default' in title) {
      expect(title.default).toContain('TruthSource')
    }
    expect(metadata.description).toContain('B2B')
  })

  it('should have proper OpenGraph metadata', () => {
    expect(metadata.openGraph).toHaveProperty('type', 'website')
    expect(metadata.openGraph).toHaveProperty('locale', 'en_US')
    if (metadata.openGraph?.title) {
      expect(metadata.openGraph.title).toContain('TruthSource')
    }
  })

  it('should have proper Twitter metadata', () => {
    expect(metadata.twitter).toHaveProperty('card', 'summary_large_image')
    if (metadata.twitter?.title) {
      expect(metadata.twitter.title).toContain('TruthSource')
    }
  })

  it('should have proper robots metadata', () => {
    expect(metadata.robots).toHaveProperty('index', true)
    expect(metadata.robots).toHaveProperty('follow', true)
  })

  it('should handle analytics components conditionally', () => {
    // Test with GA ID
    const originalEnv = process.env.NEXT_PUBLIC_GA_ID
    process.env.NEXT_PUBLIC_GA_ID = 'test-ga-id'

    const { rerender } = render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>
    )

    expect(screen.getByTestId('google-analytics')).toBeInTheDocument()

    // Test without GA ID
    delete process.env.NEXT_PUBLIC_GA_ID
    rerender(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>
    )

    expect(screen.queryByTestId('google-analytics')).not.toBeInTheDocument()

    // Restore original env
    process.env.NEXT_PUBLIC_GA_ID = originalEnv
  })
})
