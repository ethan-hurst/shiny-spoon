// Global type definitions for missing types

declare global {
  // Web API types
  interface HeadersInit {
    [key: string]: string | string[]
  }

  interface RequestInit {
    method?: string
    headers?: HeadersInit
    body?: string | FormData | ReadableStream
    mode?: RequestMode
    credentials?: RequestCredentials
    cache?: RequestCache
    redirect?: RequestRedirect
    referrer?: string
    referrerPolicy?: ReferrerPolicy
    integrity?: string
    keepalive?: boolean
    signal?: AbortSignal
  }

  // Node.js types
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test'
      NEXT_PUBLIC_SUPABASE_URL: string
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string
      SUPABASE_SERVICE_ROLE_KEY: string
      NEXT_PUBLIC_URL: string
      [key: string]: string | undefined
    }
  }

  // Jest types for test files
  const jest: any
  const describe: any
  const it: any
  const expect: any
  const beforeEach: any
  const beforeAll: any
  const afterEach: any
  const afterAll: any
}

export {} 