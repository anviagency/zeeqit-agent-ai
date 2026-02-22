import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/app.store'
import type { InstallationState } from '@shared/installation-states'
import type { InstallProgressEvent } from '@shared/ipc-channels'

interface UseInstallStateReturn {
  state: InstallationState
  loading: boolean
}

/**
 * Checks `openclaw.getStatus()` on mount to determine the installation state,
 * then subscribes to install progress events for live updates.
 */
export function useInstallState(): UseInstallStateReturn {
  const installationState = useAppStore((s) => s.installationState)
  const setInstallationState = useAppStore((s) => s.setInstallationState)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const checkStatus = useCallback(async () => {
    try {
      const result = await window.zeeqitApi.openclaw.getStatus()
      if (!mountedRef.current) return

      if (result.success && result.data) {
        const step = result.data.step
        const hasError = !!result.data.error

        let derived: InstallationState
        if (step === 'complete' && !hasError) {
          derived = 'healthy'
        } else if (hasError) {
          derived = 'interrupted'
        } else {
          derived = 'not_installed'
        }

        setInstallationState(derived)
      } else {
        setInstallationState('not_installed')
      }
    } catch {
      if (mountedRef.current) {
        setInstallationState('not_installed')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [setInstallationState])

  useEffect(() => {
    mountedRef.current = true
    void checkStatus()

    const unsub = window.zeeqitApi.events.onInstallProgress(
      (...args: unknown[]) => {
        if (!mountedRef.current) return

        const event = args[0] as InstallProgressEvent | undefined
        if (!event) return

        if (event.status === 'running') {
          setInstallationState('installing')
        } else if (event.status === 'completed' && event.step === 'complete') {
          setInstallationState('healthy')
        } else if (event.status === 'failed') {
          setInstallationState('interrupted')
        }
      }
    )

    return () => {
      mountedRef.current = false
      unsub()
    }
  }, [checkStatus, setInstallationState])

  return { state: installationState, loading }
}
