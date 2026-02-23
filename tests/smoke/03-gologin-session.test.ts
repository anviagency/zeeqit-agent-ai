import { describe, it, expect, vi, beforeEach } from 'vitest'

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

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { GoLoginService } from '../../src/main/services/gologin/client'

describe('Smoke: GoLogin session lifecycle', () => {
  let service: GoLoginService

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset singleton by accessing private field
    ;(GoLoginService as unknown as { instance: null }).instance = null
    service = GoLoginService.getInstance()
  })

  it('should validate a token via API call', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    })

    const valid = await service.validateToken('test-token-123')
    expect(valid).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/browser/v2'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token-123' }
      })
    )
  })

  it('should reject invalid token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

    const valid = await service.validateToken('bad-token')
    expect(valid).toBe(false)
  })

  it('should list profiles after token validation', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await service.validateToken('test-token')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        profiles: [
          { id: 'p1', name: 'Profile 1', os: 'win', proxy: { mode: 'none' } },
          { id: 'p2', name: 'Profile 2', os: 'mac', proxy: { mode: 'none' } }
        ]
      })
    })

    const profiles = await service.listProfiles()
    expect(profiles).toHaveLength(2)
    expect(profiles[0].id).toBe('p1')
  })

  it('should return a CDP URL when launching a profile', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await service.validateToken('test-token')

    const cdpUrl = await service.launchProfile('profile-1')
    expect(cdpUrl).toMatch(/^ws:\/\//)
    expect(cdpUrl).toContain('profile-1')
  })

  it('should stop a launched profile', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await service.validateToken('test-token')

    await service.launchProfile('profile-1')
    await expect(service.stopProfile('profile-1')).resolves.not.toThrow()
  })

  it('should clean up orphaned sessions on exit', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await service.validateToken('test-token')

    await service.launchProfile('orphan-1')
    await service.launchProfile('orphan-2')

    await expect(service.killOrphanedSessions()).resolves.not.toThrow()
  })
})
