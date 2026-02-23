import { useCallback, useState } from 'react'

interface EvidenceEntry {
  id: string
  timestamp: string
  action: string
  data: unknown
  hash: string
}

interface UseEvidenceReturn {
  chain: EvidenceEntry[]
  loading: boolean
  error: string | null
  loadChain: (workflowRunId: string) => Promise<void>
  verify: (chainId: string) => Promise<boolean>
  exportChain: (chainId: string) => Promise<string | null>
}

/**
 * Provides access to the evidence chain for a workflow run.
 * Exposes load, verify, and export operations against `window.zeeqitApi.evidence`.
 */
export function useEvidence(): UseEvidenceReturn {
  const [chain, setChain] = useState<EvidenceEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadChain = useCallback(async (workflowRunId: string) => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.zeeqitApi.evidence.getChain(workflowRunId)
      if (result.success && result.data) {
        setChain(result.data as unknown as EvidenceEntry[])
      } else {
        setError(result.error?.message ?? 'Failed to load evidence chain')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evidence chain')
    } finally {
      setLoading(false)
    }
  }, [])

  const verify = useCallback(async (chainId: string): Promise<boolean> => {
    try {
      const result = await window.zeeqitApi.evidence.verify(chainId)
      return result.success && !!result.data
    } catch {
      return false
    }
  }, [])

  const exportChain = useCallback(async (chainId: string): Promise<string | null> => {
    try {
      const result = await window.zeeqitApi.evidence.export(chainId)
      if (result.success && result.data) {
        return result.data as unknown as string
      }
      return null
    } catch {
      return null
    }
  }, [])

  return { chain, loading, error, loadChain, verify, exportChain }
}
