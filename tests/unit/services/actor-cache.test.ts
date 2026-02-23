import { describe, it, expect, vi, beforeEach } from 'vitest'

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

const mockListActors = vi.fn()

vi.mock('../../../src/main/services/apify/client', () => ({
  ApifyService: {
    getInstance: () => ({
      listActors: mockListActors
    })
  }
}))

import { ActorCache } from '../../../src/main/services/apify/actor-cache'
import type { ApifyActor, ActorCapability } from '../../../src/main/services/apify/types'

describe('ActorCache', () => {
  const testActors: ApifyActor[] = [
    {
      id: 'actor-1',
      name: 'Web Scraper',
      description: 'General purpose scraper',
      version: '1.0.0',
      capabilities: ['scrape-html'],
      allowed: true
    },
    {
      id: 'actor-2',
      name: 'SPA Scraper',
      description: 'SPA scraper',
      version: '2.0.0',
      capabilities: ['scrape-spa'],
      allowed: true
    },
    {
      id: 'actor-3',
      name: 'Blocked Actor',
      description: 'Not allowed',
      version: '1.0.0',
      capabilities: ['scrape-html'],
      allowed: false
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ActorCache as unknown as { instance: null }).instance = null
    mockListActors.mockResolvedValue(testActors)
  })

  describe('get', () => {
    it('should return a cached actor after refresh', async () => {
      const cache = ActorCache.getInstance()
      const actor = await cache.get('actor-1')

      expect(actor).not.toBeNull()
      expect(actor!.name).toBe('Web Scraper')
    })

    it('should return null for unknown actor ID', async () => {
      const cache = ActorCache.getInstance()
      const actor = await cache.get('nonexistent')

      expect(actor).toBeNull()
    })
  })

  describe('TTL expiration', () => {
    it('should refresh from API when cache is expired', async () => {
      const cache = ActorCache.getInstance()

      await cache.get('actor-1')
      expect(mockListActors).toHaveBeenCalledTimes(1)

      await cache.get('actor-1')
      expect(mockListActors).toHaveBeenCalledTimes(1)

      cache.clear()

      await cache.get('actor-1')
      expect(mockListActors).toHaveBeenCalledTimes(2)
    })
  })

  describe('allowlist filtering', () => {
    it('should report allowed actors as allowed', async () => {
      const cache = ActorCache.getInstance()
      const allowed = await cache.isAllowed('actor-1')

      expect(allowed).toBe(true)
    })

    it('should allow adding to allowlist', async () => {
      const cache = ActorCache.getInstance()
      cache.addToAllowlist('custom-actor')

      const allowed = await cache.isAllowed('custom-actor')
      expect(allowed).toBe(true)
    })

    it('should allow removing from allowlist', async () => {
      const cache = ActorCache.getInstance()
      await cache.refresh()

      cache.removeFromAllowlist('actor-1')
      const allowed = await cache.isAllowed('actor-1')
      expect(allowed).toBe(false)
    })
  })

  describe('capability tag lookup', () => {
    it('should find actors by capability', async () => {
      const cache = ActorCache.getInstance()
      await cache.refresh()
      cache.setCapabilities('actor-1', ['scrape-html'])
      cache.setCapabilities('actor-2', ['scrape-spa'])

      const htmlScrapers = await cache.findByCapability('scrape-html' as ActorCapability)
      expect(htmlScrapers.length).toBeGreaterThanOrEqual(1)
      expect(htmlScrapers.some((a) => a.id === 'actor-1')).toBe(true)
    })

    it('should return empty array for capability with no actors', async () => {
      const cache = ActorCache.getInstance()
      await cache.refresh()

      const pdfActors = await cache.findByCapability('pdf' as ActorCapability)
      expect(pdfActors).toEqual([])
    })
  })

  describe('clear', () => {
    it('should empty the cache', async () => {
      const cache = ActorCache.getInstance()
      await cache.get('actor-1')

      cache.clear()

      mockListActors.mockResolvedValue([])
      const actor = await cache.get('actor-1')
      expect(actor).toBeNull()
    })
  })
})
