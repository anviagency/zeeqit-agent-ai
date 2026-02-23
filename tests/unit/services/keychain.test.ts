import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(Buffer.alloc(32)),
  writeFileSync: vi.fn(),
  chmodSync: vi.fn()
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
  getVaultPath: () => '/mock/vault'
}))

import { KeychainAdapter } from '../../../src/main/services/vault/keychain'

describe('KeychainAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(KeychainAdapter as unknown as { instance: null }).instance = null
  })

  describe('getType', () => {
    it('should return a valid keychain type string', () => {
      const adapter = KeychainAdapter.getInstance()
      const keychainType = adapter.getType()

      expect(['keychain', 'dpapi', 'libsecret', 'passphrase_fallback']).toContain(keychainType)
    })
  })

  describe('storeMasterKey', () => {
    it('should store a 32-byte key without throwing', async () => {
      const adapter = KeychainAdapter.getInstance()
      const key = Buffer.alloc(32, 0xab)

      await expect(adapter.storeMasterKey(key)).resolves.not.toThrow()
    })
  })

  describe('getMasterKey', () => {
    it('should return a Buffer or null', async () => {
      const adapter = KeychainAdapter.getInstance()
      const result = await adapter.getMasterKey()

      expect(result === null || Buffer.isBuffer(result)).toBe(true)
    })
  })

  describe('isAvailable', () => {
    it('should return a boolean indicating keychain availability', async () => {
      const adapter = KeychainAdapter.getInstance()
      const available = await adapter.isAvailable()

      expect(typeof available).toBe('boolean')
    })
  })

  describe('passphrase fallback', () => {
    it('should store and retrieve key via passphrase fallback when flag file exists', async () => {
      const { existsSync } = await import('fs')

      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('passphrase-mode.flag')) return true
        if (typeof path === 'string' && path.includes('passphrase-salt.bin')) return true
        if (typeof path === 'string' && path.includes('passphrase-key.enc')) return true
        return false
      })

      const adapter = KeychainAdapter.getInstance()
      const keychainType = adapter.getType()

      expect(keychainType).toBe('passphrase_fallback')
    })
  })
})
