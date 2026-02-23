import { useEffect, useRef } from 'react'
import { useAppStore, type GatewayConnectionState } from '@/store/app.store'
import type { GatewayStateEvent } from '@shared/ipc-channels'
import { api } from '@/api'

interface UseGatewayReturn {
  state: GatewayConnectionState
}

/**
 * Subscribes to gateway state events pushed from the main process
 * and keeps the app store in sync. Cleans up the listener on unmount.
 */
export function useGateway(): UseGatewayReturn {
  const gatewayState = useAppStore((s) => s.gatewayState)
  const setGatewayState = useAppStore((s) => s.setGatewayState)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const unsub = api.events.onGatewayState(
      (...args: unknown[]) => {
        if (!mountedRef.current) return

        const event = args[0] as GatewayStateEvent | undefined
        if (!event) return

        setGatewayState(event.state)
      }
    )

    return () => {
      mountedRef.current = false
      unsub()
    }
  }, [setGatewayState])

  return { state: gatewayState }
}
