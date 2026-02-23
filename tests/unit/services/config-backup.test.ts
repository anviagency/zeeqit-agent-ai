import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn()
}))

const mockReaddir = vi.fn()
const mockUnlink = vi.fn().mockResolvedValue(undefined)

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  open: vi.fn().mockResolvedValue({ sync: vi.fn(), close: vi.fn() })
}))

vi.mock('proper-lockfile', () => ({
  default: { lock: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)) }
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
  getConfigHistoryPath: () => '/mock/config-history'
}))

vi.mock('../../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn().mockResolvedValue(undefined)
}))

import { ConfigBackup } from '../../../src/main/services/openclaw/config-backup'

describe('ConfigBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(ConfigBackup as unknown as { instance: null }).instance = null
  })

  describe('backup', () => {
    it('should create a backup with a timestamp-based ID', async () => {
      mockReaddir.mockResolvedValue([])
      const backup = ConfigBackup.getInstance()
      const config = { identity: { name: 'Test' } }

      const id = await backup.backup(config)

      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('pruneOldBackups', () => {
    it('should keep at most 10 backups (FIFO pruning)', async () => {
      const files = Array.from({ length: 12 }, (_, i) =>
        `config-backup-2024-01-${String(i + 1).padStart(2, '0')}T00-00-00-000Z.json`
      )

      mockReaddir.mockResolvedValue(files)

      const backup = ConfigBackup.getInstance()
      await backup.pruneOldBackups()

      expect(mockUnlink).toHaveBeenCalledTimes(2)
    })

    it('should not prune when backup count is within limit', async () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        `config-backup-2024-01-${String(i + 1).padStart(2, '0')}T00-00-00-000Z.json`
      )

      mockReaddir.mockResolvedValue(files)

      const backup = ConfigBackup.getInstance()
      await backup.pruneOldBackups()

      expect(mockUnlink).not.toHaveBeenCalled()
    })
  })

  describe('listBackups', () => {
    it('should return backups sorted newest first', async () => {
      const files = [
        'config-backup-2024-01-01T00-00-00-000Z.json',
        'config-backup-2024-06-15T12-30-00-000Z.json',
        'config-backup-2024-03-10T08-00-00-000Z.json'
      ]

      mockReaddir.mockResolvedValue(files)

      const backup = ConfigBackup.getInstance()
      const backups = await backup.listBackups()

      expect(backups).toHaveLength(3)
      expect(backups[0].id > backups[1].id).toBe(true)
      expect(backups[1].id > backups[2].id).toBe(true)
    })

    it('should return empty array when no backups exist', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(false)

      const backup = ConfigBackup.getInstance()
      const backups = await backup.listBackups()

      expect(backups).toEqual([])
    })
  })
})
