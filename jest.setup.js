// Jest DOM extensions
import '@testing-library/jest-dom'

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '',
      query: '',
      asPath: '',
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Supabase client to avoid ES module issues
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
      signInWithPassword: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    rpc: jest.fn(),
  })),
}))

// Mock @supabase/ssr
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
      signInWithPassword: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    rpc: jest.fn(),
  })),
  createBrowserClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
      signInWithPassword: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    rpc: jest.fn(),
  })),
}))

// Mock Supabase admin client
jest.mock('@/lib/supabase/admin', () => {
  const mockSupabaseAdmin = {
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
      },
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    rpc: jest.fn(),
  }

  return {
    supabaseAdmin: mockSupabaseAdmin,
    createUserWithOrganization: jest.fn(),
    deleteUserCompletely: jest.fn(),
    updateUserOrganization: jest.fn(),
    adminQuery: jest.fn(),
  }
})

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Mock crypto module for webhook verification
jest.mock('crypto', () => ({
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hmac-digest')
  })),
  timingSafeEqual: jest.fn((a, b) => {
    // Return true if the signatures match, false otherwise
    const aStr = a.toString()
    const bStr = b.toString()
    return aStr === bStr
  })
}))

// Mock @upstash/ratelimit
const MockRatelimit = jest.fn().mockImplementation(() => ({
  limit: jest.fn().mockResolvedValue({
    success: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 60000
  }),
  reset: jest.fn(),
  blockUntilReady: jest.fn(),
  getRemaining: jest.fn()
}))

MockRatelimit.slidingWindow = jest.fn().mockReturnValue('sliding-window-limiter')

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: MockRatelimit,
  slidingWindow: MockRatelimit.slidingWindow
}))

// Mock @upstash/redis
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
    fromEnv: jest.fn()
  })),
  fromEnv: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn()
  }))
}))

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock Request and Response for Next.js API routes
global.Request = class {
  constructor(input, init = {}) {
    // Don't set url property if it's read-only (like in NextRequest)
    if (typeof input === 'string') {
      // Use Object.defineProperty to avoid read-only property error
      Object.defineProperty(this, 'url', {
        value: input,
        writable: false,
        enumerable: true,
        configurable: true
      })
    } else if (input && typeof input.url === 'string') {
      Object.defineProperty(this, 'url', {
        value: input.url,
        writable: false,
        enumerable: true,
        configurable: true
      })
    }
    this.method = init.method || 'GET'
    this.headers = new Map(Object.entries(init.headers || {}))
    this.body = init.body
  }
}

// Add TextEncoder polyfill for Next.js components
global.TextEncoder = class {
  encode(text) {
    return new Uint8Array(Buffer.from(text, 'utf8'))
  }
}

global.TextDecoder = class {
  decode(bytes) {
    return Buffer.from(bytes).toString('utf8')
  }
}

global.Response = class {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.statusText = init.statusText || 'OK'
    this.headers = new Map(Object.entries(init.headers || {}))
  }

  static redirect(url, status = 307) {
    const response = new Response(null, {
      status,
      headers: { location: url },
    })
    return response
  }

  static json(data, init = {}) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init.headers,
      },
    })
  }

  get(name) {
    return this.headers.get(name) || null
  }

  set(name, value) {
    this.headers.set(name, value)
  }
}

// Suppress console errors during tests (optional)
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
