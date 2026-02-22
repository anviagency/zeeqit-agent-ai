import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn()
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('{}'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  open: vi.fn().mockResolvedValue({ sync: vi.fn(), close: vi.fn() }),
  unlink: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('proper-lockfile', () => ({
  default: { lock: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)) }
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
  getConfigHistoryPath: () => '/mock/config-history'
}))

vi.mock('../../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn().mockResolvedValue(undefined),
  atomicReadFile: vi.fn().mockResolvedValue('{}')
}))

import { ConfigCompiler } from '../../../src/main/services/openclaw/config-compiler'

describe('ConfigCompiler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(ConfigCompiler as unknown as { instance: null }).instance = null
  })

  describe('compile', () => {
    it('should compile valid Zeeqit state into OpenClaw config', () => {
      const compiler = ConfigCompiler.getInstance()
      const state = {
        identity: { name: 'Test Agent', theme: 'dark', emoji: '◇' },
        models: { primary: 'claude-sonnet-4-20250514', fallbacks: ['gpt-4o'] },
        workspace: '~/.openclaw/workspace'
      }

      const result = compiler.compile(state)

      expect(result).toHaveProperty('identity')
      expect(result).toHaveProperty('agents')
      expect(result.agents.defaults.model.primary).toBe('claude-sonnet-4-20250514')
    })

    it('should throw on invalid config with meaningful error', () => {
      const compiler = ConfigCompiler.getInstance()
      const invalidState = {
        models: { primary: '' },
        maxConcurrent: 999
      }

      expect(() => compiler.compile(invalidState)).toThrow('Config validation failed')
    })

    it('should apply defaults for missing optional fields', () => {
      const compiler = ConfigCompiler.getInstance()
      const minimalState = {
        models: { primary: 'claude-sonnet-4-20250514' }
      }

      const result = compiler.compile(minimalState)

      expect(result.agents.defaults.thinkingDefault).toBe('low')
      expect(result.agents.defaults.maxConcurrent).toBe(3)
      expect(result.agents.defaults.timeoutSeconds).toBe(600)
    })
  })

  describe('diff', () => {
    it('should return type "new" when no current config exists on disk', async () => {
      const compiler = ConfigCompiler.getInstance()
      const { existsSync } = await import('fs')

      vi.mocked(existsSync).mockReturnValue(false)

      const state = {
        identity: { name: 'Agent', theme: '', emoji: '◇' },
        models: { primary: 'claude-sonnet-4-20250514', fallbacks: [] },
        workspace: '~/.openclaw/workspace'
      }

      const diff = await compiler.diff(state)
      expect(diff).not.toBeNull()
      const parsed = JSON.parse(diff!)
      expect(parsed.type).toBe('new')
    })

    it('should detect changes between configs', async () => {
      const compiler = ConfigCompiler.getInstance()
      const { atomicReadFile } = await import('../../../src/main/services/platform/atomic-fs')
      const { existsSync } = await import('fs')

      const currentConfig = {
        identity: { name: 'Old Agent', theme: '', emoji: '◇' },
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

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(atomicReadFile).mockResolvedValue(JSON.stringify(currentConfig))

      const newState = {
        identity: { name: 'New Agent' },
        models: { primary: 'gpt-4o', fallbacks: [] },
        workspace: '~/.openclaw/workspace'
      }

      const diff = await compiler.diff(newState)
      expect(diff).not.toBeNull()
      const parsed = JSON.parse(diff!)
      expect(parsed).toBeDefined()
    })
  })
})
