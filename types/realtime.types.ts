import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type RealtimeChangePayload<T extends { [key: string]: any }> = RealtimePostgresChangesPayload<T>

export type RealtimeEventHandler<T extends { [key: string]: any }> = (
  payload: RealtimeChangePayload<T>
) => void | Promise<void>

export interface RealtimeChannelConfig<T extends { [key: string]: any }> {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema: string
  table: string
  filter?: string
  handler: RealtimeEventHandler<T>
}