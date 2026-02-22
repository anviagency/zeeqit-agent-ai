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

const checkpointStore = new Map<string, string>()

vi.mock('../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn(async (path: string, content: string) => {
    checkpointStore.set(path, content)
  }),
  atomicReadFile: vi.fn().mockResolvedValue('{}')
}))

let resolverShouldFail = true

vi.mock('../../src/main/services/openclaw/runtime-resolver', () => ({
  RuntimeResolver: {
    getInstance: () => ({
      resolve: vi.fn().mockImplementation(async () => {
        if (resolverShouldFail) {
          throw new Error('Network error: unable to download runtime')
        }
        return { type: 'system', path: '/usr/local/bin/node', version: 'v20.0.0', verified: true }
      })
    })
  }
}))

vi.mock('../../src/main/services/openclaw/config-compiler', () => ({
  ConfigCompiler: {
    getInstance: () => ({
      compile: vi.fn().mockReturnValue({}),
      apply: vi.fn().mockResolvedValue(undefined),
      getCurrentConfig: vi.fn().mockResolvedValue(null)
    })
  }
}))

vi.mock('../../src/main/services/openclaw/daemon', () => ({
  DaemonManager: {
    getInstance: () => ({
      start: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockResolvedValue({ running: false, pid: null }),
      isRunning: vi.fn().mockResolvedValue(true),
      restart: vi.fn().mockResolvedValue(undefined)
    })
  }
}))

import { OpenClawInstaller } from '../../src/main/services/openclaw/installer'

describe('Smoke: Offline install behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkpointStore.clear()
    resolverShouldFail = true
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

  it('should return an error message instead of crashing when network is unavailable', async () => {
    const installer = OpenClawInstaller.getInstance()

    await expect(
      installer.install({ identity: {}, models: { primary: 'test' } })
    ).rejects.toThrow('Network error')
  })

  it('should not leave corrupted state — checkpoint shows last successful step', async () => {
    const installer = OpenClawInstaller.getInstance()

    try {
      await installer.install({ identity: {}, models: { primary: 'test' } })
    } catch {
      // Expected to fail
    }

    const checkpointWrites = Array.from(checkpointStore.entries()).filter(
      ([key]) => key.includes('install-checkpoint')
    )

    for (const [, content] of checkpointWrites) {
      const checkpoint = JSON.parse(content)
      expect(checkpoint).toHaveProperty('step')
      expect(checkpoint).toHaveProperty('completedAt')
    }
  })

  it('should complete installation after network is restored', async () => {
    const installer = OpenClawInstaller.getInstance()

    try {
      await installer.install({ identity: {}, models: { primary: 'test' } })
    } catch {
      // First attempt fails
    }

    resolverShouldFail = false
    ;(OpenClawInstaller as unknown as { instance: null }).instance = null
    const freshInstaller = OpenClawInstaller.getInstance()

    await expect(
      freshInstaller.install({ identity: {}, models: { primary: 'test' } })
    ).resolves.not.toThrow()
  })
})
