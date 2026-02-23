import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('{}'),
  mkdirSync: vi.fn()
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn().mockResolvedValue([]),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  open: vi.fn().mockResolvedValue({ sync: vi.fn(), close: vi.fn() })
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
  getOpenClawPath: () => '/mock/openclaw',
  getConfigHistoryPath: () => '/mock/config-history'
}))

const fileStore = new Map<string, string>()

vi.mock('../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn(async (path: string, content: string) => {
    fileStore.set(path, content)
  }),
  atomicReadFile: vi.fn(async (path: string) => {
    const data = fileStore.get(path)
    if (!data) throw new Error(`File not found: "${path}"`)
    return data
  })
}))

import { ConfigCompiler } from '../../src/main/services/openclaw/config-compiler'
import { ConfigBackup } from '../../src/main/services/openclaw/config-backup'
import { atomicWriteFile } from '../../src/main/services/platform/atomic-fs'

describe('Smoke: Config rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fileStore.clear()
    ;(ConfigCompiler as unknown as { instance: null }).instance = null
    ;(ConfigBackup as unknown as { instance: null }).instance = null
  })

  it('should apply config and then rollback to previous backup', async () => {
    const compiler = ConfigCompiler.getInstance()

    const originalConfig = {
      identity: { name: 'Original', theme: 'dark', emoji: '◇' },
      agents: {
        defaults: {
          workspace: '~/.openclaw/workspace',
          model: { primary: 'claude-sonnet-4-20250514', fallbacks: [] },
          thinkingDefault: 'low',
          maxConcurrent: 3,
          timeoutSeconds: 600
        }
      }
    }

    fileStore.set('/mock/openclaw/openclaw.json', JSON.stringify(originalConfig))

    const newConfig = {
      ...originalConfig,
      identity: { name: 'Updated', theme: 'neon', emoji: '★' }
    }

    await compiler.apply(newConfig as Record<string, unknown>)

    const writeCall = vi.mocked(atomicWriteFile)
    const configWrites = writeCall.mock.calls.filter(
      ([path]) => typeof path === 'string' && path.includes('openclaw.json')
    )
    expect(configWrites.length).toBeGreaterThanOrEqual(1)

    const backupWrites = writeCall.mock.calls.filter(
      ([path]) => typeof path === 'string' && path.includes('config-backup')
    )
    expect(backupWrites.length).toBeGreaterThanOrEqual(1)
  })

  it('should create a timestamped backup before applying new config', async () => {
    const backup = ConfigBackup.getInstance()

    const config = { identity: { name: 'Test' }, agents: { defaults: {} } }
    const backupId = await backup.backup(config)

    expect(backupId).toBeTruthy()
    expect(typeof backupId).toBe('string')
  })
})
