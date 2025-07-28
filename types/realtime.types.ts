import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// Base record interface for database tables
export interface BaseRecord {
  id: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export type RealtimeChangePayload<T extends BaseRecord> = RealtimePostgresChangesPayload<T>

export type RealtimeEventHandler<T extends BaseRecord> = (
  payload: RealtimeChangePayload<T>
) => void | Promise<void>

export interface RealtimeChannelConfig<T extends BaseRecord> {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema: string
  table: string
  filter?: string
  handler: RealtimeEventHandler<T>
}