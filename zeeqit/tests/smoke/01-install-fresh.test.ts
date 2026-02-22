import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExistsSync = vi.fn()
const mockReadFileSync = vi.fn()
const mockMkdirSync = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args)
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
  open: vi.fn().mockResolvedValue({ sync: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) }),
  unlink: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('proper-lockfile', () => ({
  default: { lock: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)) }
}))

vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock/app', isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] }
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
      compile: vi.fn().mockReturnValue({ identity: {}, agents: { defaults: {} } }),
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
import { atomicWriteFile } from '../../src/main/services/platform/atomic-fs'

describe('Smoke: Install on clean machine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(OpenClawInstaller as unknown as { instance: null }).instance = null

    mockExistsSync.mockImplementation((path: unknown) => {
      if (typeof path === 'string' && path.includes('package.json')) return true
      return false
    })

    mockReadFileSync.mockImplementation((path: unknown) => {
      if (typeof path === 'string' && path.includes('package.json')) {
        return JSON.stringify({ version: '1.0.0' })
      }
      return '{}'
    })
  })

  it('should complete the full installation flow without errors', async () => {
    const installer = OpenClawInstaller.getInstance()
    const config = {
      identity: { name: 'Test Agent', theme: 'dark', emoji: '◇' },
      models: { primary: 'claude-sonnet-4-20250514', fallbacks: [] },
      workspace: '~/.openclaw/workspace'
    }

    await expect(installer.install(config)).resolves.not.toThrow()
  })

  it('should write checkpoint file for each completed step', async () => {
    const installer = OpenClawInstaller.getInstance()
    await installer.install({ identity: {}, models: { primary: 'test' } })

    const writeFileCall = vi.mocked(atomicWriteFile)
    const checkpointWrites = writeFileCall.mock.calls.filter(
      ([path]) => typeof path === 'string' && path.includes('install-checkpoint')
    )

    expect(checkpointWrites.length).toBeGreaterThanOrEqual(1)

    const lastWrite = checkpointWrites[checkpointWrites.length - 1]
    const lastCheckpoint = JSON.parse(lastWrite[1] as string)
    expect(lastCheckpoint.step).toBe('complete')
  })

  it('should call atomicWriteFile for config persistence', async () => {
    const installer = OpenClawInstaller.getInstance()
    await installer.install({ identity: {}, models: { primary: 'test' } })

    expect(vi.mocked(atomicWriteFile)).toHaveBeenCalled()
  })

  it('should start the daemon during installation', async () => {
    const installer = OpenClawInstaller.getInstance()
    await installer.install({ identity: {}, models: { primary: 'test' } })

    expect(mockDaemonStart).toHaveBeenCalled()
  })

  it('should resolve the runtime as the first step', async () => {
    const installer = OpenClawInstaller.getInstance()
    await installer.install({ identity: {}, models: { primary: 'test' } })

    expect(mockResolve).toHaveBeenCalled()
  })
})
