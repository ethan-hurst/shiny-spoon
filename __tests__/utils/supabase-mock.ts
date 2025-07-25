import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types/database'

type MockSupabaseClient = jest.Mocked<SupabaseClient<Database>>

interface MockQueryBuilder {
  insert: jest.Mock
  update: jest.Mock
  delete: jest.Mock
  select: jest.Mock
  eq: jest.Mock
  neq: jest.Mock
  gt: jest.Mock
  gte: jest.Mock
  lt: jest.Mock
  lte: jest.Mock
  like: jest.Mock
  ilike: jest.Mock
  is: jest.Mock
  in: jest.Mock
  contains: jest.Mock
  containedBy: jest.Mock
  range: jest.Mock
  or: jest.Mock
  and: jest.Mock
  not: jest.Mock
  filter: jest.Mock
  order: jest.Mock
  limit: jest.Mock
  single: jest.Mock
  maybeSingle: jest.Mock
  count: jest.Mock
  upsert: jest.Mock
  rpc: jest.Mock
  explain: jest.Mock
  rollback: jest.Mock
  match: jest.Mock
  url?: URL
  headers?: Record<string, string>
}

/**
 * Creates a mock Supabase query builder with all standard query methods mocked for testing.
 *
 * All methods except `single` and `maybeSingle` are chainable by default. The `single` and `maybeSingle` methods resolve to an object with `data: null` and `error: null`. Optional overrides allow customization of any method or property.
 *
 * @param overrides - Optional partial overrides for specific methods or properties of the mock query builder
 * @returns A mock query builder object with chainable methods and default resolved values for `single` and `maybeSingle`
 */
export function createMockQueryBuilder(overrides?: Partial<MockQueryBuilder>): any {
  const builder: MockQueryBuilder = {
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    select: jest.fn(),
    eq: jest.fn(),
    neq: jest.fn(),
    gt: jest.fn(),
    gte: jest.fn(),
    lt: jest.fn(),
    lte: jest.fn(),
    like: jest.fn(),
    ilike: jest.fn(),
    is: jest.fn(),
    in: jest.fn(),
    contains: jest.fn(),
    containedBy: jest.fn(),
    range: jest.fn(),
    or: jest.fn(),
    and: jest.fn(),
    not: jest.fn(),
    filter: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    rpc: jest.fn(),
    explain: jest.fn(),
    rollback: jest.fn(),
    match: jest.fn(),
    url: new URL('https://mock.supabase.co'),
    headers: {},
    ...overrides,
  } as MockQueryBuilder

  // Make all methods chainable except single/maybeSingle
  Object.keys(builder).forEach((key) => {
    const method = key as keyof MockQueryBuilder
    if (method !== 'single' && method !== 'maybeSingle') {
      if (builder[method] && typeof builder[method] === 'function' && 'mockReturnValue' in builder[method]) {
        (builder[method] as any).mockReturnValue(builder)
      }
    }
  })

  // Set default resolved values for single/maybeSingle
  builder.single.mockResolvedValue({ data: null, error: null })
  builder.maybeSingle.mockResolvedValue({ data: null, error: null })

  return builder
}

/**
 * Creates a fully mocked Supabase client for testing purposes.
 *
 * The returned mock client includes mocked authentication, query, channel, function, and storage interfaces, with all methods set up for use in Jest-based unit tests.
 *
 * @returns A mocked Supabase client with all major methods and properties stubbed for testing.
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  const mockClient = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      }),
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              app_metadata: {},
              user_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString(),
            },
          },
        },
        error: null,
      }),
      signIn: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
      refreshSession: jest.fn(),
      setSession: jest.fn(),
      updateUser: jest.fn(),
    },
    from: jest.fn(() => createMockQueryBuilder()),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
    getChannels: jest.fn().mockReturnValue([]),
    removeAllChannels: jest.fn(),
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        download: jest.fn(),
        createSignedUrl: jest.fn(),
        createSignedUrls: jest.fn(),
        list: jest.fn(),
        remove: jest.fn(),
        copy: jest.fn(),
        move: jest.fn(),
        getPublicUrl: jest.fn(),
      })),
    },
  } as unknown as MockSupabaseClient

  return mockClient
}

/**
 * Configures the mock Supabase client to simulate an authenticated user with the specified user ID.
 *
 * Sets the `auth.getUser` mock to resolve with a user object containing the provided `userId` and default test user data.
 *
 * @param userId - The ID to assign to the mocked user (defaults to `'test-user-id'`)
 */
export function setupAuthenticatedUser(mockClient: MockSupabaseClient, userId = 'test-user-id') {
  (mockClient.auth.getUser as jest.Mock).mockResolvedValue({
    data: {
      user: {
        id: userId,
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    },
    error: null,
  })
}

/**
 * Configures the mock Supabase client to simulate an unauthenticated user.
 *
 * Sets the `auth.getUser` mock to resolve with `user: null`, representing a user who is not signed in.
 */
export function setupUnauthenticatedUser(mockClient: MockSupabaseClient) {
  (mockClient.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

/**
 * Configures a mock query builder to resolve its `single` and `maybeSingle` methods with the specified data and error.
 *
 * Also ensures the `select` method returns the mock query builder for method chaining.
 *
 * @param mockQueryBuilder - The mock query builder to configure
 * @param data - The data value to resolve with for `single` and `maybeSingle`
 * @param error - The error value to resolve with for `single` and `maybeSingle` (defaults to null)
 * @returns The configured mock query builder
 */
export function setupQueryResult<T>(
  mockQueryBuilder: any,
  data: T | null,
  error: any = null
) {
  const builder = mockQueryBuilder as unknown as MockQueryBuilder
  builder.single.mockResolvedValue({ data, error })
  builder.maybeSingle.mockResolvedValue({ data, error })
  builder.select.mockReturnValue(mockQueryBuilder)
  return mockQueryBuilder
}