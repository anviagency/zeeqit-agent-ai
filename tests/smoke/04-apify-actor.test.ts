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

import { ApifyService } from '../../src/main/services/apify/client'

describe('Smoke: Apify actor execution', () => {
  let service: ApifyService

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ApifyService as unknown as { instance: null }).instance = null
    service = ApifyService.getInstance()
  })

  it('should validate a valid Apify token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })

    const valid = await service.validateToken('apify_test_token')
    expect(valid).toBe(true)
  })

  it('should reject an invalid Apify token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })

    const valid = await service.validateToken('bad_token')
    expect(valid).toBe(false)
  })

  it('should list actors after token validation', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await service.validateToken('apify_test_token')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          items: [
            { id: 'actor-1', name: 'Web Scraper', description: 'Scrapes stuff', version: '1.0' },
            { id: 'actor-2', name: 'Data Miner', description: 'Mines data', version: '2.0' }
          ]
        }
      })
    })

    const actors = await service.listActors()
    expect(actors).toHaveLength(2)
    expect(actors[0].name).toBe('Web Scraper')
  })

  it('should run an actor and return run info', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await service.validateToken('apify_test_token')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: 'run-123',
          status: 'RUNNING',
          startedAt: new Date().toISOString(),
          defaultDatasetId: 'dataset-abc'
        }
      })
    })

    const runInfo = await service.runActor('actor-1', { startUrls: [{ url: 'https://example.com' }] })
    expect(runInfo.runId).toBe('run-123')
    expect(runInfo.actorId).toBe('actor-1')
    expect(runInfo.status).toBe('RUNNING')
  })

  it('should fetch dataset items with normalized results', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await service.validateToken('apify_test_token')

    const mockItems = [
      { title: 'Product A', price: 29.99 },
      { title: 'Product B', price: 49.99 },
      { title: 'Product C', price: 19.99 }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockItems
    })

    const items = await service.getDatasetItems('dataset-abc')
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]).toHaveProperty('title')
  })
})
