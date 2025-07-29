import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/'
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
  redirect: vi.fn(),
  notFound: vi.fn()
}))

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => new Map())
}))

// Mock crypto for webhook signature verification
Object.defineProperty(global, 'crypto', {
  value: {
    createHmac: vi.fn((algorithm: string) => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mock_signature')
    }))
  }
})

// Mock fetch globally
global.fetch = vi.fn()

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
  value: vi.fn(() => ({
    getPropertyValue: vi.fn(() => ''),
  })),
})

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  value: vi.fn(() => 'mock-url'),
})

// Mock URL.revokeObjectURL
Object.defineProperty(URL, 'revokeObjectURL', {
  value: vi.fn(),
})

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 0))
global.cancelAnimationFrame = vi.fn()

// Mock performance.now
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
  },
})

// Mock TextEncoder and TextDecoder
global.TextEncoder = vi.fn(() => ({
  encode: vi.fn((text: string) => new Uint8Array(Buffer.from(text, 'utf8'))),
  encodeInto: vi.fn(),
}))

global.TextDecoder = vi.fn(() => ({
  decode: vi.fn((buffer: Uint8Array) => Buffer.from(buffer).toString('utf8')),
}))

// Mock AbortController
global.AbortController = vi.fn(() => ({
  signal: {
    aborted: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  abort: vi.fn(),
}))

// Mock structuredClone
global.structuredClone = vi.fn((obj) => JSON.parse(JSON.stringify(obj)))

// Setup test environment variables
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Mock environment variables for testing
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')

// Global test utilities
global.testUtils = {
  mockFetch: (response: any) => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    })
  },
  mockFetchError: (error: any) => {
    ;(global.fetch as any).mockRejectedValue(error)
  },
  mockFetchResponse: (response: any) => {
    ;(global.fetch as any).mockResolvedValue(response)
  },
  clearMocks: () => {
    vi.clearAllMocks()
  },
  resetMocks: () => {
    vi.resetAllMocks()
  },
}

// Extend expect matchers
expect.extend({
  toBeInTheDocument(received) {
    const pass = received !== null && received !== undefined
    return {
      pass,
      message: () => `expected ${received} to be in the document`,
    }
  },
  toHaveTextContent(received, expected) {
    const pass = received.textContent?.includes(expected)
    return {
      pass,
      message: () => `expected ${received} to have text content ${expected}`,
    }
  },
  toHaveValue(received, expected) {
    const pass = received.value === expected
    return {
      pass,
      message: () => `expected ${received} to have value ${expected}`,
    }
  },
})