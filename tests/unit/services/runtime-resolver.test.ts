import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExistsSync = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args)
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.alloc(100))
}))

const mockExecFile = vi.fn()

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args)
}))

vi.mock('util', () => ({
  promisify: () => (...args: unknown[]) => {
    return new Promise((resolve, reject) => {
      const lastArg = args[args.length - 1]
      if (typeof lastArg === 'function') {
        lastArg(null, { stdout: 'v20.0.0' })
      } else {
        mockExecFile(...args)
          .then(resolve)
          .catch(reject)
      }
    })
  }
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

vi.mock('../../../src/main/services/openclaw/runtime-integrity', () => ({
  verifyBinary: vi.fn().mockResolvedValue(true),
  getManifest: vi.fn().mockResolvedValue(null)
}))

import { RuntimeResolver } from '../../../src/main/services/openclaw/runtime-resolver'

describe('RuntimeResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(RuntimeResolver as unknown as { instance: null }).instance = null
  })

  describe('findEmbedded', () => {
    it('should return embedded runtime when binary exists', async () => {
      mockExistsSync.mockReturnValue(true)
      mockExecFile.mockResolvedValue({ stdout: 'v20.0.0' })

      const resolver = RuntimeResolver.getInstance()
      const result = await resolver.findEmbedded()

      expect(result).not.toBeNull()
      expect(result!.type).toBe('embedded')
    })

    it('should return null when embedded binary is missing', async () => {
      mockExistsSync.mockReturnValue(false)

      const resolver = RuntimeResolver.getInstance()
      const result = await resolver.findEmbedded()

      expect(result).toBeNull()
    })
  })

  describe('findSystem', () => {
    it('should find system node when available on PATH', async () => {
      mockExecFile
        .mockResolvedValueOnce({ stdout: 'v20.0.0\n' })
        .mockResolvedValueOnce({ stdout: '/usr/local/bin/node\n' })

      const resolver = RuntimeResolver.getInstance()
      const result = await resolver.findSystem()

      expect(result).not.toBeNull()
      expect(result!.type).toBe('system')
      expect(result!.version).toBe('v20.0.0')
    })

    it('should return null when node is not on PATH', async () => {
      mockExecFile.mockRejectedValue(new Error('command not found'))

      const resolver = RuntimeResolver.getInstance()
      const result = await resolver.findSystem()

      expect(result).toBeNull()
    })
  })

  describe('downloadRuntime', () => {
    it('should return null (download not yet implemented)', async () => {
      const resolver = RuntimeResolver.getInstance()
      const result = await resolver.downloadRuntime()

      expect(result).toBeNull()
    })
  })

  describe('getCurrentPlatformKey', () => {
    it('should return a valid platform key string', () => {
      const resolver = RuntimeResolver.getInstance()
      const key = resolver.getCurrentPlatformKey()

      expect(['darwin-arm64', 'darwin-x64', 'linux-x64', 'win-x64']).toContain(key)
    })
  })
})
