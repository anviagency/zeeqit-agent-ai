import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExistsSync = vi.fn()
const mockReadFileSync = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  mkdirSync: vi.fn()
}))

vi.mock('child_process', () => ({
  execFile: vi.fn()
}))

vi.mock('util', () => ({
  promisify: () => vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
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

const mockResolve = vi.fn().mockResolvedValue({
  type: 'system',
  path: '/usr/local/bin/node',
  version: 'v20.0.0',
  verified: true
})

vi.mock('../../src/main/services/openclaw/runtime-resolver', () => ({
  RuntimeResolver: {
    getInstance: () => ({ resolve: mockResolve })
  }
}))

const mockApply = vi.fn().mockResolvedValue(undefined)

vi.mock('../../src/main/services/openclaw/config-compiler', () => ({
  ConfigCompiler: {
    getInstance: () => ({
      compile: vi.fn().mockReturnValue({}),
      apply: mockApply,
      getCurrentConfig: vi.fn().mockResolvedValue(null)
    })
  }
}))

const mockDaemonStart = vi.fn().mockResolvedValue(undefined)

vi.mock('../../src/main/services/openclaw/daemon', () => ({
  DaemonManager: {
    getInstance: () => ({
      start: mockDaemonStart,
      getStatus: vi.fn().mockResolvedValue({ running: false, pid: null }),
      isRunning: vi.fn().mockResolvedValue(true),
      restart: vi.fn().mockResolvedValue(undefined)
    })
  }
}))

import { OpenClawInstaller } from '../../src/main/services/openclaw/installer'

describe('Smoke: Interrupted install resume', () => {
  const checkpoint = {
    step: 'config',
    completedAt: new Date().toISOString(),
    version: '1.0.0'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(OpenClawInstaller as unknown as { instance: null }).instance = null

    mockExistsSync.mockImplementation((path: unknown) => {
      if (typeof path === 'string' && path.includes('install-checkpoint')) return true
      if (typeof path === 'string' && path.includes('package.json')) return true
      return false
    })

    mockReadFileSync.mockImplementation((path: unknown) => {
      if (typeof path === 'string' && path.includes('install-checkpoint')) {
        return JSON.stringify(checkpoint)
      }
      if (typeof path === 'string' && path.includes('package.json')) {
        return JSON.stringify({ version: '1.0.0' })
      }
      return '{}'
    })
  })

  it('should read checkpoint and report step 3 (config)', () => {
    const installer = OpenClawInstaller.getInstance()
    const result = installer.getCheckpoint()

    expect(result).not.toBeNull()
    expect(result!.step).toBe('config')
  })

  it('should resume from step 4 (credentials) when checkpoint is at step 3 (config)', async () => {
    const installer = OpenClawInstaller.getInstance()
    await installer.install({ identity: {}, models: { primary: 'test' } })

    expect(mockResolve).not.toHaveBeenCalled()
    expect(mockApply).not.toHaveBeenCalled()
  })

  it('should not re-execute steps 1-3 when resuming from step 3', async () => {
    const installer = OpenClawInstaller.getInstance()
    await installer.install({ identity: {}, models: { primary: 'test' } })

    expect(mockResolve).not.toHaveBeenCalled()
    expect(mockApply).not.toHaveBeenCalled()

    expect(mockDaemonStart).toHaveBeenCalled()
  })
})
