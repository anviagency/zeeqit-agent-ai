import { LogRing } from '../diagnostics/log-ring'
import { ApifyService } from './client'
import type { ApifyActor, ActorCapability, ActorCacheEntry } from './types'

const logger = LogRing.getInstance()

const DEFAULT_TTL_MS = 60_000

/**
 * Caches Apify actor metadata with configurable TTL, allowlist filtering,
 * and capability-based lookup.
 *
 * Actors not on the allowlist are excluded from capability queries and
 * execution via {@link ActorRunner}.
 */
export class ActorCache {
  private static instance: ActorCache | null = null
  private readonly cache = new Map<string, ActorCacheEntry>()
  private readonly allowlist = new Set<string>()
  private readonly capabilityIndex = new Map<ActorCapability, Set<string>>()
  private lastFullRefresh = 0
  private readonly ttlMs: number

  private constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  /** Returns the singleton ActorCache instance. */
  static getInstance(): ActorCache {
    if (!ActorCache.instance) {
      ActorCache.instance = new ActorCache()
    }
    return ActorCache.instance
  }

  /**
   * Gets a cached actor by ID, refreshing from the API if stale.
   *
   * @param actorId - Apify actor ID.
   * @returns Actor descriptor, or `null` if not found.
   */
  async get(actorId: string): Promise<ApifyActor | null> {
    try {
      const entry = this.cache.get(actorId)

      if (entry && Date.now() - entry.cachedAt < this.ttlMs) {
        return entry.actor
      }

      await this.refresh()
      return this.cache.get(actorId)?.actor ?? null
    } catch (err) {
      logger.error('Failed to get actor from cache', {
        actorId,
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Checks whether an actor is on the allowlist.
   *
   * @param actorId - Apify actor ID to check.
   * @returns `true` if the actor is allowed for execution.
   */
  async isAllowed(actorId: string): Promise<boolean> {
    try {
      if (this.allowlist.size === 0) {
        await this.refresh()
      }

      return this.allowlist.has(actorId)
    } catch (err) {
      logger.error('Failed to check actor allowlist', {
        actorId,
        error: err instanceof Error ? err.message : String(err)
      })
      return false
    }
  }

  /**
   * Finds actors matching a specific capability tag.
   *
   * @param capability - Capability tag to search for.
   * @returns Array of actors with the given capability, filtered by allowlist.
   */
  async findByCapability(capability: ActorCapability): Promise<ApifyActor[]> {
    try {
      if (Date.now() - this.lastFullRefresh > this.ttlMs) {
        await this.refresh()
      }

      const actorIds = this.capabilityIndex.get(capability)
      if (!actorIds || actorIds.size === 0) return []

      const result: ApifyActor[] = []
      for (const id of actorIds) {
        const entry = this.cache.get(id)
        if (entry && this.allowlist.has(id)) {
          result.push(entry.actor)
        }
      }

      return result
    } catch (err) {
      logger.error('Failed to find actors by capability', {
        capability,
        error: err instanceof Error ? err.message : String(err)
      })
      return []
    }
  }

  /**
   * Adds an actor ID to the execution allowlist.
   *
   * @param actorId - Actor ID to allow.
   */
  addToAllowlist(actorId: string): void {
    this.allowlist.add(actorId)
    logger.debug('Actor added to allowlist', { actorId })
  }

  /**
   * Removes an actor ID from the execution allowlist.
   *
   * @param actorId - Actor ID to disallow.
   */
  removeFromAllowlist(actorId: string): void {
    this.allowlist.delete(actorId)
    logger.debug('Actor removed from allowlist', { actorId })
  }

  /**
   * Sets capability tags for an actor and updates the capability index.
   *
   * @param actorId - Actor ID.
   * @param capabilities - Array of capability tags.
   */
  setCapabilities(actorId: string, capabilities: ActorCapability[]): void {
    try {
      const entry = this.cache.get(actorId)
      if (entry) {
        for (const cap of entry.actor.capabilities) {
          this.capabilityIndex.get(cap)?.delete(actorId)
        }
        entry.actor.capabilities = capabilities
      }

      for (const cap of capabilities) {
        if (!this.capabilityIndex.has(cap)) {
          this.capabilityIndex.set(cap, new Set())
        }
        this.capabilityIndex.get(cap)!.add(actorId)
      }
    } catch (err) {
      logger.error('Failed to set actor capabilities', {
        actorId,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  /**
   * Forces a cache refresh from the Apify API.
   */
  async refresh(): Promise<void> {
    try {
      const actors = await ApifyService.getInstance().listActors()
      const now = Date.now()

      for (const actor of actors) {
        this.cache.set(actor.id, { actor, cachedAt: now })
        if (actor.allowed) {
          this.allowlist.add(actor.id)
        }
      }

      this.lastFullRefresh = now
      logger.debug('Actor cache refreshed', { count: actors.length })
    } catch (err) {
      logger.error('Actor cache refresh failed', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  /**
   * Clears all cached data.
   */
  clear(): void {
    this.cache.clear()
    this.capabilityIndex.clear()
    this.lastFullRefresh = 0
    logger.debug('Actor cache cleared')
  }
}
