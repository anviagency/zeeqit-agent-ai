import { useCallback, useEffect, useRef, useState } from 'react'
import type { IpcResult } from '@shared/ipc-channels'
import { api } from '@/api'

interface UseIpcState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseIpcReturn<T> extends UseIpcState<T> {
  refetch: () => Promise<void>
}

/**
 * Generic hook that wraps an api call, unwraps the IpcResult envelope,
 * and exposes `{ data, loading, error, refetch }`.
 *
 * @param fetcher - An async function that returns an `IpcResult<T>` (e.g. `() => api.openclaw.getStatus()`)
 * @param options.immediate - Whether to call the fetcher on mount (default: true)
 *
 * @example
 * ```ts
 * const { data, loading, error, refetch } = useIpc(
 *   () => api.daemon.logs(50)
 * )
 * ```
 */
export function useIpc<T>(
  fetcher: () => Promise<IpcResult<T>>,
  options: { immediate?: boolean } = {}
): UseIpcReturn<T> {
  const { immediate = true } = options
  const mountedRef = useRef(true)

  const [state, setState] = useState<UseIpcState<T>>({
    data: null,
    loading: immediate,
    error: null
  })

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const result = await fetcher()

      if (!mountedRef.current) return

      if (result.success) {
        setState({ data: (result.data ?? null) as T | null, loading: false, error: null })
      } else {
        const message = result.error?.message ?? 'Unknown IPC error'
        setState((prev) => ({ ...prev, loading: false, error: message }))
      }
    } catch (err) {
      if (!mountedRef.current) return
      const message = err instanceof Error ? err.message : 'IPC call failed'
      setState((prev) => ({ ...prev, loading: false, error: message }))
    }
  }, [fetcher])

  useEffect(() => {
    mountedRef.current = true
    if (immediate) {
      void execute()
    }
    return () => {
      mountedRef.current = false
    }
  }, [execute, immediate])

  return { ...state, refetch: execute }
}
