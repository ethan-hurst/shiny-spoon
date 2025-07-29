import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types/database'

export type MockSupabaseClient = {
  from: jest.MockedFunction<SupabaseClient<Database>['from']>
  rpc: jest.MockedFunction<SupabaseClient<Database>['rpc']>
  auth: {
    getUser: jest.MockedFunction<SupabaseClient<Database>['auth']['getUser']>
    signOut: jest.MockedFunction<SupabaseClient<Database>['auth']['signOut']>
  }
}

export function createMockSupabaseClient(): MockSupabaseClient {
  const mockClient = {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      containedBy: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      overlaps: jest.fn().mockReturnThis(),
      match: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      csv: jest.fn().mockResolvedValue({ data: null, error: null }),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    })) as unknown as jest.MockedFunction<SupabaseClient<Database>['from']>,
    
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }) as unknown as jest.MockedFunction<SupabaseClient<Database>['rpc']>,
    
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
          } 
        }, 
        error: null 
      }) as unknown as jest.MockedFunction<SupabaseClient<Database>['auth']['getUser']>,
      
      signOut: jest.fn().mockResolvedValue({ 
        error: null 
      }) as unknown as jest.MockedFunction<SupabaseClient<Database>['auth']['signOut']>,
    },
  }
  
  return mockClient
}

export function mockSupabaseResponse<T>(
  data: T | null = null,
  error: Error | null = null
): { data: T | null; error: Error | null } {
  return { data, error }
}