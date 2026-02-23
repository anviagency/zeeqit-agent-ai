import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('net', () => ({
  createConnection: vi.fn((_opts: unknown, cb: Function) => {
    if (cb) setTimeout(cb, 0)
    return {
      on: vi.fn(),
      destroy: vi.fn()
    }
  })
}))

vi.mock('../../../src/main/services/diagnostics/log-ring', () => ({
  LogRing: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    })
  }
}))

vi.mock('../../../src/main/services/gateway/websocket-client', () => ({
  GatewayWebSocketClient: {
    getInstance: () => ({
      getState: vi.fn().mockReturnValue('connected'),
      getLastHeartbeat: vi.fn().mockReturnValue(new Date().toISOString())
    })
  }
}))

vi.mock('../../../src/main/services/gateway/rpc', () => ({
  GatewayRpc: {
    getInstance: () => ({
      configGet: vi.fn().mockResolvedValue({ version: '1.0.0' })
    })
  }
}))

vi.mock('../../../src/main/services/vault/credential-store', () => ({
  CredentialStore: {
    getInstance: () => ({
      get: vi.fn().mockResolvedValue('mock-token-value')
    })
  }
}))

const mockRepair = vi.fn().mockResolvedValue({ overallSuccess: true, steps: [], completedAt: '' })

vi.mock('../../../src/main/services/openclaw/installer', () => ({
  OpenClawInstaller: {
    getInstance: () => ({
      repair: mockRepair
    })
  }
}))

import { HealthMonitor } from '../../../src/main/services/openclaw/health'
import { AUTO_REPAIR_THRESHOLD } from '../../../src/shared/health-contract'

describe('HealthMonitor - Health contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(HealthMonitor as unknown as { instance: null }).instance = null
  })

  it('should return green when all checks pass', async () => {
    const monitor = HealthMonitor.getInstance()
    monitor.setDaemonPid(process.pid)
    monitor.setExpectedConfigVersion('1.0.0')

    const result = await monitor.evaluate()

    expect(result.overall).toBe('green')
    expect(result.consecutiveFailures).toBe(0)
  })

  it('should return red when a required check fails', async () => {
    const monitor = HealthMonitor.getInstance()
    monitor.setDaemonPid(99999999)

    const result = await monitor.evaluate()

    expect(result.overall).toBe('red')
  })

  it('should track consecutive failure counter', async () => {
    const monitor = HealthMonitor.getInstance()
    monitor.setDaemonPid(99999999)

    await monitor.evaluate()
    const result2 = await monitor.evaluate()

    expect(result2.consecutiveFailures).toBe(2)
  })

  it('should reset consecutive failures when evaluation passes', async () => {
    const monitor = HealthMonitor.getInstance()

    monitor.setDaemonPid(99999999)
    await monitor.evaluate()
    await monitor.evaluate()

    monitor.setDaemonPid(process.pid)
    monitor.setExpectedConfigVersion('1.0.0')
    const result = await monitor.evaluate()

    expect(result.overall).toBe('green')
    expect(result.consecutiveFailures).toBe(0)
  })

  it('should trigger auto-repair after threshold consecutive failures', async () => {
    const monitor = HealthMonitor.getInstance()
    monitor.setDaemonPid(99999999)

    for (let i = 0; i < AUTO_REPAIR_THRESHOLD; i++) {
      await monitor.evaluate()
    }

    expect(mockRepair).toHaveBeenCalled()
  })

  it('should include GoLogin checks only when enabled', async () => {
    const monitor = HealthMonitor.getInstance()
    monitor.setDaemonPid(process.pid)
    monitor.setExpectedConfigVersion('1.0.0')
    monitor.setGoLoginEnabled(true)

    const result = await monitor.evaluate()

    const goLoginChecks = result.checks.filter(
      (c) => c.id.startsWith('gologin')
    )
    expect(goLoginChecks.length).toBeGreaterThan(0)
  })
})
