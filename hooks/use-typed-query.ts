import { PostgrestError } from '@supabase/supabase-js'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'

export function useTypedQuery<TData, TError = PostgrestError>(
  key: unknown[],
  fn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TData, TError>({
    queryKey: key,
    queryFn: fn,
    ...options,
  })
}
