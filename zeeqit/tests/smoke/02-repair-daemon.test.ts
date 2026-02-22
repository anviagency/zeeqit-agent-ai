import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('{}'),
  mkdirSync: vi.fn()
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('{}'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  open: vi.fn().mockResolvedValue({ sync: vi.fn(), close: vi.fn() }),
  unlink: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('proper-lockfile', () => ({
  default: { lock: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)) }
}))

vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock/app', isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] }
}))

const mockDaemonRestart = vi.fn().mockResolvedValue(undefined)
const mockDaemonGetStatus = vi.fn().mockResolvedValue({ running: false, pid: null })
const mockDaemonIsRunning = vi.fn().mockResolvedValue(false)

vi.mock('../../src/main/services/openclaw/daemon', () => ({
  DaemonManager: {
    getInstance: () => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: mockDaemonRestart,
      getStatus: mockDaemonGetStatus,
      isRunning: mockDaemonIsRunning
    })
  }
}))

vi.mock('../../src/main/services/openclaw/runtime-resolver', () => ({
  RuntimeResolver: {
    getInstance: () => ({
      resolve: vi.fn().mockResolvedValue({
        type: 'system',
        path: '/usr/local/bin/node',
        version: 'v20.0.0',
        verified: true
      })
    })
  }
}))

vi.mock('../../src/main/services/openclaw/config-compiler', () => ({
  ConfigCompiler: {
    getInstance: () => ({
      getCurrentConfig: vi.fn().mockResolvedValue({ identity: {}, agents: { defaults: {} } })
    })
  }
}))

vi.mock('../../src/main/services/diagnostics/log-ring', () => ({
  LogRing: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    })
  }
}))

vi.mock('../../src/main/services/platform/app-paths', () => ({
  getCheckpointPath: () => '/mock/checkpoint',
  getOpenClawPath: () => '/mock/openclaw',
  getConfigHistoryPath: () => '/mock/config-history'
}))

vi.mock('../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn().mockResolvedValue(undefined),
  atomicReadFile: vi.fn().mockResolvedValue('{}')
}))

import { OpenClawInstaller } from '../../src/main/services/openclaw/installer'

describe('Smoke: Repair after daemon death', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should execute all 10 repair steps', async () => {
    const installer = OpenClawInstaller.getInstance()
    const report = await installer.repair()

    expect(report.steps).toHaveLength(10)
  })

  it('should attempt daemon restart when daemon is not running', async () => {
    const installer = OpenClawInstaller.getInstance()
    const report = await installer.repair()

    const daemonStep = report.steps.find((s) => s.step === 'Verify daemon process')
    expect(daemonStep).toBeDefined()
    expect(daemonStep!.passed).toBe(false)

    expect(mockDaemonRestart).toHaveBeenCalled()
  })

  it('should run health check as part of repair', async () => {
    const installer = OpenClawInstaller.getInstance()
    const report = await installer.repair()

    const healthStep = report.steps.find((s) => s.step === 'Verify health')
    expect(healthStep).toBeDefined()
  })

  it('should return a completedAt timestamp', async () => {
    const installer = OpenClawInstaller.getInstance()
    const report = await installer.repair()

    expect(report.completedAt).toBeDefined()
    expect(new Date(report.completedAt).getTime()).not.toBeNaN()
  })

  it('should produce a repair report with overallSuccess field', async () => {
    const installer = OpenClawInstaller.getInstance()
    const report = await installer.repair()

    expect(typeof report.overallSuccess).toBe('boolean')
  })
})
