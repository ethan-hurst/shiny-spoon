import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type RealtimeChangePayload<T> = RealtimePostgresChangesPayload<T>

export type RealtimeEventHandler<T> = (
  payload: RealtimeChangePayload<T>
) => void | Promise<void>

export interface RealtimeChannelConfig<T> {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema: string
  table: string
  filter?: string
  handler: RealtimeEventHandler<T>
}