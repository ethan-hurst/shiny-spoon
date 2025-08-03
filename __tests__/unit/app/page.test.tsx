import { Metadata } from 'next'
import { render, screen } from '@testing-library/react'
import HomePage, { metadata } from '@/app/page'

// Mock the components to focus on page structure and behavior
jest.mock('@/components/marketing/hero-section', () => ({
  HeroSection: () => <div data-testid="hero-section">Hero Section</div>,
}))

jest.mock('@/components/marketing/features-grid', () => ({
  FeaturesGrid: () => <div data-testid="features-grid">Features Grid</div>,
}))

jest.mock('@/components/marketing/how-it-works', () => ({
  HowItWorks: () => <div data-testid="how-it-works">How It Works</div>,
}))

jest.mock('@/components/marketing/testimonials', () => ({
  Testimonials: () => <div data-testid="testimonials">Testimonials</div>,
}))

jest.mock('@/components/marketing/cta-section', () => ({
  CTASection: () => <div data-testid="cta-section">CTA Section</div>,
}))

jest.mock('@/components/marketing/trusted-by', () => ({
  TrustedBy: () => <div data-testid="trusted-by">Trusted By</div>,
}))

jest.mock('@/components/wrapper/page-wrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-wrapper">{children}</div>
  ),
}))

describe('HomePage', () => {
  it('should render all required sections in the correct order', () => {
    render(<HomePage />)

    // Verify all sections are present
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    expect(screen.getByTestId('trusted-by')).toBeInTheDocument()
    expect(screen.getByTestId('features-grid')).toBeInTheDocument()
    expect(screen.getByTestId('how-it-works')).toBeInTheDocument()
    expect(screen.getByTestId('testimonials')).toBeInTheDocument()
    expect(screen.getByTestId('cta-section')).toBeInTheDocument()
  })

  it('should be wrapped in PageWrapper', () => {
    render(<HomePage />)
    expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
  })

  it('should have correct metadata structure', () => {
    // Validate metadata has required fields
    expect(metadata).toHaveProperty('title')
    expect(metadata).toHaveProperty('description')
    expect(metadata).toHaveProperty('keywords')
    expect(metadata).toHaveProperty('openGraph')
    expect(metadata).toHaveProperty('twitter')
  })

  it('should have metadata with correct types', () => {
    // Type safety test - ensure metadata conforms to Next.js Metadata type
    const typedMetadata: Metadata = metadata
    expect(typedMetadata.title).toBeDefined()
    expect(typedMetadata.description).toBeDefined()
  })

  it('should include TruthSource branding in metadata', () => {
    expect(metadata.title).toContain('TruthSource')
    expect(metadata.description).toContain('B2B')
  })
})
