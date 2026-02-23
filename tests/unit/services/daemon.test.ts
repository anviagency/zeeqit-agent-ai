import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── mocks (before imports) ──────────────────────────────────────────

const mockExecFile = vi.fn()

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => {
    const cb = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void
    const result = mockExecFile(...args.slice(0, -1))
    if (result instanceof Error) {
      cb(result, { stdout: '', stderr: result.message })
    } else {
      cb(null, result)
    }
  }
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(''),
  mkdirSync: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock/app', isPackaged: false }
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

vi.mock('../../../src/main/services/platform/app-paths', () => ({
  getOpenClawPath: () => '/mock/openclaw',
  getAppDataPath: () => '/mock/appdata'
}))

import { DaemonManager } from '../../../src/main/services/openclaw/daemon'

describe('DaemonManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(DaemonManager as unknown as { instance: null }).instance = null
  })

  describe('getStatus', () => {
    it('should call "openclaw gateway status --json" to detect running state', async () => {
      mockExecFile.mockReturnValue({
        stdout: JSON.stringify({
          running: true,
          pid: 12345,
          port: 18789,
          version: '2026.2.22-2'
        }),
        stderr: ''
      })

      const mgr = DaemonManager.getInstance()
      const status = await mgr.getStatus()

      expect(mockExecFile).toHaveBeenCalledWith(
        'openclaw',
        expect.arrayContaining(['gateway', 'status', '--json']),
        expect.any(Object)
      )
      expect(status.running).toBe(true)
      expect(status.pid).toBe(12345)
    })

    it('should return not-running when openclaw gateway status fails', async () => {
      mockExecFile.mockReturnValue(new Error('openclaw not found'))

      const mgr = DaemonManager.getInstance()
      const status = await mgr.getStatus()

      expect(status.running).toBe(false)
      expect(status.pid).toBeNull()
    })

    it('should parse non-JSON status output by detecting "Runtime: running"', async () => {
      mockExecFile.mockReturnValue({
        stdout: [
          'Service: LaunchAgent (loaded)',
          'Runtime: running (pid 11604, state active)',
          'RPC probe: ok'
        ].join('\n'),
        stderr: ''
      })

      const mgr = DaemonManager.getInstance()
      const status = await mgr.getStatus()

      expect(status.running).toBe(true)
      expect(status.pid).toBe(11604)
    })
  })

  describe('start', () => {
    it('should call "openclaw gateway start" instead of launchctl', async () => {
      mockExecFile.mockReturnValue({ stdout: 'Gateway started', stderr: '' })

      const mgr = DaemonManager.getInstance()
      await mgr.start()

      expect(mockExecFile).toHaveBeenCalledWith(
        'openclaw',
        expect.arrayContaining(['gateway', 'start']),
        expect.any(Object)
      )
      // Must NOT call launchctl directly
      const calls = mockExecFile.mock.calls
      const launchctlCalls = calls.filter(
        (c: unknown[]) => c[0] === 'launchctl'
      )
      expect(launchctlCalls).toHaveLength(0)
    })
  })

  describe('stop', () => {
    it('should call "openclaw gateway stop" instead of launchctl', async () => {
      mockExecFile.mockReturnValue({ stdout: 'Gateway stopped', stderr: '' })

      const mgr = DaemonManager.getInstance()
      await mgr.stop()

      expect(mockExecFile).toHaveBeenCalledWith(
        'openclaw',
        expect.arrayContaining(['gateway', 'stop']),
        expect.any(Object)
      )
      const calls = mockExecFile.mock.calls
      const launchctlCalls = calls.filter(
        (c: unknown[]) => c[0] === 'launchctl'
      )
      expect(launchctlCalls).toHaveLength(0)
    })
  })

  describe('restart', () => {
    it('should call stop then start via openclaw CLI', async () => {
      mockExecFile.mockReturnValue({ stdout: 'ok', stderr: '' })

      const mgr = DaemonManager.getInstance()
      await mgr.restart()

      const openclawCalls = mockExecFile.mock.calls.filter(
        (c: unknown[]) => c[0] === 'openclaw'
      )
      const subcommands = openclawCalls.map((c: unknown[]) => (c[1] as string[])[1])
      expect(subcommands).toContain('stop')
      expect(subcommands).toContain('start')
    })
  })

  describe('isRunning', () => {
    it('should return true when gateway status reports running', async () => {
      mockExecFile.mockReturnValue({
        stdout: 'Runtime: running (pid 11604, state active)',
        stderr: ''
      })

      const mgr = DaemonManager.getInstance()
      const running = await mgr.isRunning()

      expect(running).toBe(true)
    })

    it('should return false when gateway status reports not running', async () => {
      mockExecFile.mockReturnValue({
        stdout: 'Runtime: stopped',
        stderr: ''
      })

      const mgr = DaemonManager.getInstance()
      const running = await mgr.isRunning()

      expect(running).toBe(false)
    })
  })
})
