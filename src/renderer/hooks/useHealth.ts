import { useCallback, useEffect, useRef } from 'react'
import { useAppStore, type HealthLights } from '@/store/app.store'
import type { HealthContractResult } from '@shared/health-contract'
import { HEALTH_CHECK_INTERVAL_MS } from '@shared/health-contract'
import type { HealthLightState } from '@shared/ipc-channels'
import { api } from '@/api'

function deriveLight(
  checks: HealthContractResult['checks'],
  ids: string[]
): HealthLightState {
  const relevant = checks.filter((c) => ids.includes(c.id))
  if (relevant.length === 0) {
    return { status: 'yellow', tooltip: 'No checks available', checks: [] }
  }

  const allPassed = relevant.every((c) => c.passed)
  const anyRequired = relevant.some((c) => c.required && !c.passed)

  return {
    status: anyRequired ? 'red' : allPassed ? 'green' : 'yellow',
    tooltip: relevant.map((c) => `${c.name}: ${c.passed ? 'OK' : c.message}`).join('\n'),
    checks: relevant.map((c) => ({
      name: c.name,
      passed: c.passed,
      message: c.message
    }))
  }
}

/**
 * Polls `diagnostics.health()` at the contract-defined interval (60 s)
 * and updates the app store health lights.
 *
 * @returns Current health lights from the store.
 */
export function useHealth(): HealthLights {
  const healthLights = useAppStore((s) => s.healthLights)
  const setHealthLights = useAppStore((s) => s.setHealthLights)
  const mountedRef = useRef(true)

  const poll = useCallback(async () => {
    try {
      const result = await api.diagnostics.health()
      if (!mountedRef.current) return
      if (!result.success || !result.data) return

      const { checks } = result.data

      setHealthLights({
        zeeqitService: deriveLight(checks, ['process_alive']),
        openclawGateway: deriveLight(checks, [
          'gateway_port_open',
          'ws_handshake',
          'heartbeat_fresh'
        ]),
        browserEngine: deriveLight(checks, [
          'gologin_token_valid',
          'gologin_profile_exists'
        ])
      })
    } catch {
      /* polling failure is non-fatal; next cycle will retry */
    }
  }, [setHealthLights])

  useEffect(() => {
    mountedRef.current = true
    void poll()

    const timer = setInterval(() => void poll(), HEALTH_CHECK_INTERVAL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [poll])

  return healthLights
}
