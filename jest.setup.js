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

// Mock Supabase admin client - FIXED
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
    createAdminClient: jest.fn(() => mockSupabaseAdmin),
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

// Mock crypto module for webhook verification and hashing
jest.mock('crypto', () => ({
  createHmac: jest.fn((algorithm, secret) => ({
    update: jest.fn((data, encoding) => {
      // Store the data for digest calculation
      const mockHmac = {
        _data: data,
        _secret: secret,
        update: jest.fn().mockReturnThis(),
        digest: jest.fn((format) => {
          // Generate a deterministic hash for testing
          const input = `${secret}:${data}`
          let hash = 0
          for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
          }
          const hashString = Math.abs(hash).toString(16).padStart(8, '0')
          return format === 'base64' ? Buffer.from(hashString).toString('base64') : hashString
        })
      }
      return mockHmac
    }),
    digest: jest.fn()
  })),
  createHash: jest.fn((algorithm) => {
    const mockHash = {
      update: jest.fn((data) => {
        mockHash._data = data.toString()
        return mockHash
      }),
      digest: jest.fn(() => {
        // Generate a deterministic hash for testing
        const input = mockHash._data || ''
        let hash = 0
        for (let i = 0; i < input.length; i++) {
          const char = input.charCodeAt(i)
          hash = ((hash << 5) - hash) + char
          hash = hash & hash
        }
        const uniqueHash = Math.abs(hash).toString(16).padStart(8, '0') + 
                          input.length.toString(16).padStart(4, '0') +
                          (input.charCodeAt(0) || 0).toString(16).padStart(4, '0') +
                          (input.charCodeAt(Math.floor(input.length / 2)) || 0).toString(16).padStart(4, '0')
        return uniqueHash.padStart(64, '0')
      }),
      _data: ''
    }
    
    return mockHash
  }),
  timingSafeEqual: jest.fn((a, b) => {
    // Return true if the signatures match, false otherwise
    const aStr = a.toString()
    const bStr = b.toString()
    return aStr === bStr
  }),
  subtle: {
    importKey: jest.fn().mockResolvedValue({}),
    sign: jest.fn().mockImplementation(async (algorithm, key, data) => {
      // Create a deterministic signature based on the data
      const hashArray = new Uint8Array(32)
      for (let i = 0; i < Math.min(data.length, 32); i++) {
        hashArray[i] = data[i] ^ 0x42 // Simple XOR for deterministic hash
      }
      return hashArray.buffer
    }),
    verify: jest.fn().mockResolvedValue(true),
    encrypt: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
    decrypt: jest.fn().mockResolvedValue(new Uint8Array([5, 6, 7, 8]).buffer),
    generateKey: jest.fn().mockResolvedValue({}),
    digest: jest.fn().mockImplementation(async (algorithm, data) => {
      // Create a deterministic hash based on the data
      const hashArray = new Uint8Array(32)
      for (let i = 0; i < Math.min(data.length, 32); i++) {
        hashArray[i] = data[i] ^ 0x42 // Simple XOR for deterministic hash
      }
      return hashArray.buffer
    }),
  },
  getRandomValues: jest.fn((array) => {
    // Fill array with deterministic "random" values for testing
    for (let i = 0; i < array.length; i++) {
      array[i] = (i * 7 + 13) % 256
    }
    return array
  }),
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

// Mock NextResponse for Next.js API routes
jest.mock('next/server', () => {
  class MockNextResponse {
    constructor(body, init = {}) {
      this.body = body
      this.status = init.status || 200
      this.statusText = init.statusText || 'OK'
      this.headers = new Map(Object.entries(init.headers || {}))
    }

    static json(data, init = {}) {
      return new MockNextResponse(JSON.stringify(data), {
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

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body)
      }
      return this.body
    }
  }

  return {
    NextRequest: class {
      constructor(url, init) {
        this.url = url
        this.method = init?.method || 'GET'
        this.headers = new Map(Object.entries(init?.headers || {}))
      }
    },
    NextResponse: MockNextResponse
  }
})

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

  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body)
    }
    return this.body
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
