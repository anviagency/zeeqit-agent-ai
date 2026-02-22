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

const mockIsAllowed = vi.fn()
const mockFindByCapability = vi.fn()

vi.mock('../../../src/main/services/apify/actor-cache', () => ({
  ActorCache: {
    getInstance: () => ({
      isAllowed: mockIsAllowed,
      findByCapability: mockFindByCapability,
      refresh: vi.fn().mockResolvedValue(undefined)
    })
  }
}))

import { TaskPlanner } from '../../../src/main/services/routing/planner'

describe('TaskPlanner - Routing decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(TaskPlanner as unknown as { instance: null }).instance = null
  })

  describe('auto mode', () => {
    it('should select Apify when a known actor is available and allowed', async () => {
      mockIsAllowed.mockResolvedValue(true)
      mockFindByCapability.mockResolvedValue([])

      const planner = TaskPlanner.getInstance()
      const plan = await planner.plan(
        'https://www.amazon.com/product/123',
        'Extract product price',
        'auto'
      )

      expect(plan.strategy).toBe('apify')
      expect(plan.apifyActorId).toContain('amazon')
    })

    it('should fall back to browser when no suitable Apify actor is found', async () => {
      mockIsAllowed.mockResolvedValue(false)
      mockFindByCapability.mockResolvedValue([])

      const planner = TaskPlanner.getInstance()
      const plan = await planner.plan(
        'https://custom-website.com/data',
        'Extract table data',
        'auto'
      )

      expect(plan.strategy).toBe('browser')
      expect(plan.apifyActorId).toBeNull()
    })

    it('should use capability-based lookup for non-pattern URLs', async () => {
      mockIsAllowed.mockResolvedValue(false)
      mockFindByCapability.mockResolvedValue([
        { id: 'actor-scraper', name: 'Scraper', capabilities: ['scrape-html'], allowed: true }
      ])

      const planner = TaskPlanner.getInstance()
      const plan = await planner.plan(
        'https://some-unique-site.com/api',
        'Extract listings',
        'auto'
      )

      expect(plan.strategy).toBe('apify')
      expect(plan.apifyActorId).toBe('actor-scraper')
    })
  })

  describe('browser-only mode', () => {
    it('should skip Apify entirely', async () => {
      const planner = TaskPlanner.getInstance()
      const plan = await planner.plan(
        'https://www.amazon.com/product/123',
        'Extract product price',
        'browser'
      )

      expect(plan.strategy).toBe('browser')
      expect(plan.apifyActorId).toBeNull()
      expect(mockIsAllowed).not.toHaveBeenCalled()
    })
  })

  describe('apify mode', () => {
    it('should throw when apify mode is requested but no actor is found', async () => {
      mockFindByCapability.mockResolvedValue([])

      const planner = TaskPlanner.getInstance()
      const plan = await planner.plan(
        'https://unique-site.com',
        'Extract data',
        'apify'
      )

      expect(plan.strategy).toBe('browser')
      expect(plan.reasoning).toContain('error')
    })
  })
})
