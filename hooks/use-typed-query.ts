import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { PostgrestError } from '@supabase/supabase-js'

/**
 * A strongly typed wrapper around `useQuery` for executing asynchronous queries with custom data and error types.
 *
 * @param key - Unique array used to identify the query in the cache
 * @param fn - Asynchronous function that fetches and returns the query data
 * @param options - Optional configuration for the query, excluding `queryKey` and `queryFn`
 * @returns The result of the query, typed with the specified data and error types
 */
export function useTypedQuery<TData, TError = PostgrestError>(
  key: unknown[],
  fn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TData, TError>({
    queryKey: key,
    queryFn: fn,
    ...options
  })
}