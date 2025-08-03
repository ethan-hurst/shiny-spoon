// Custom React Query hooks for NetSuite sync data
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'

export interface SyncState {
  id: string
  entity_type: string
  sync_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  last_sync_at: string | null
  sync_duration: number | null
  total_records: number | null
  records_processed: number | null
  error_count: number | null
  created_at: string
  updated_at: string
}

export interface IntegrationLog {
  id: string
  severity: 'info' | 'warning' | 'error' | 'critical' | 'debug'
  log_type: string
  message: string
  details?: Record<string, any> | null
  created_at: string
}

/**
 * Hook for fetching NetSuite sync status
 * Automatically refetches every 30 seconds to keep data fresh
 */
export function useNetSuiteSyncStatus(integrationId: string) {
  const supabase = createBrowserClient()

  return useQuery({
    queryKey: ['netsuite-sync-status', integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('netsuite_sync_state')
        .select('*')
        .eq('integration_id', integrationId)
        .order('entity_type')

      if (error) throw error
      return data as SyncState[]
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: true,
    enabled: !!integrationId,
    staleTime: 10000, // Consider data stale after 10 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
}

/**
 * Hook for fetching NetSuite integration logs
 * Automatically refetches every 30 seconds to keep data fresh
 */
export function useNetSuiteLogs(integrationId: string, limit = 50) {
  const supabase = createBrowserClient()

  return useQuery({
    queryKey: ['netsuite-logs', integrationId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_logs')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data as IntegrationLog[]
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: true,
    enabled: !!integrationId,
    staleTime: 10000, // Consider data stale after 10 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
}

/**
 * Hook for manually refreshing sync data
 */
export function useRefreshSyncData(integrationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // This is just a trigger to invalidate queries
      await Promise.resolve()
    },
    onSuccess: () => {
      // Invalidate both queries to force refresh
      queryClient.invalidateQueries({
        queryKey: ['netsuite-sync-status', integrationId],
      })
      queryClient.invalidateQueries({
        queryKey: ['netsuite-logs', integrationId],
      })
    },
  })
}

/**
 * Hook for getting aggregated sync statistics
 */
export function useNetSuiteSyncStats(integrationId: string) {
  const { data: syncStates } = useNetSuiteSyncStatus(integrationId)

  const stats = syncStates?.reduce(
    (acc, state) => {
      acc.total++
      if (state.sync_status === 'in_progress') acc.inProgress++
      if (state.sync_status === 'failed') acc.failed++
      if (state.sync_status === 'completed') acc.completed++
      if (state.error_count) acc.totalErrors += state.error_count
      if (state.records_processed) acc.totalRecords += state.records_processed
      return acc
    },
    {
      total: 0,
      inProgress: 0,
      failed: 0,
      completed: 0,
      totalErrors: 0,
      totalRecords: 0,
    }
  )

  return stats
}
