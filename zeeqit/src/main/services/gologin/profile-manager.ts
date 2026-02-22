import { LogRing } from '../diagnostics/log-ring'
import { GoLoginService } from './client'
import type { GoLoginProfile } from './types'

const logger = LogRing.getInstance()

/** Criteria for filtering GoLogin profiles. */
export interface ProfileFilter {
  os?: GoLoginProfile['os']
  status?: GoLoginProfile['status']
  namePattern?: string
}

/** Profile with computed suitability score for task assignment. */
export interface ScoredProfile {
  profile: GoLoginProfile
  score: number
  reasons: string[]
}

/**
 * High-level GoLogin profile management: filtering, selection, and health monitoring.
 *
 * Wraps {@link GoLoginService} to provide task-oriented profile operations
 * such as finding the best available profile for a scraping task.
 */
export class ProfileManager {
  private static instance: ProfileManager | null = null

  private constructor() {}

  /** Returns the singleton ProfileManager instance. */
  static getInstance(): ProfileManager {
    if (!ProfileManager.instance) {
      ProfileManager.instance = new ProfileManager()
    }
    return ProfileManager.instance
  }

  /**
   * Lists profiles matching the given filter criteria.
   *
   * @param filter - Optional filter criteria (OS, status, name pattern).
   * @returns Filtered list of GoLogin profiles.
   */
  async listFiltered(filter?: ProfileFilter): Promise<GoLoginProfile[]> {
    try {
      const allProfiles = await GoLoginService.getInstance().listProfiles()

      if (!filter) return allProfiles

      return allProfiles.filter((p) => {
        if (filter.os && p.os !== filter.os) return false
        if (filter.status && p.status !== filter.status) return false
        if (filter.namePattern) {
          const regex = new RegExp(filter.namePattern, 'i')
          if (!regex.test(p.name)) return false
        }
        return true
      })
    } catch (err) {
      logger.error('Failed to list filtered profiles', {
        filter,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Selects the best profile for a task based on availability, proxy config, and OS.
   *
   * @param preferredOs - Preferred operating system fingerprint.
   * @param requireProxy - Whether a proxy is required for the task.
   * @returns The best matching profile, or `null` if none available.
   */
  async selectBest(preferredOs?: GoLoginProfile['os'], requireProxy = false): Promise<GoLoginProfile | null> {
    try {
      const profiles = await this.listFiltered({ status: 'ready' })

      if (profiles.length === 0) {
        logger.warn('No ready profiles available for selection')
        return null
      }

      const scored = profiles.map((profile) => this.scoreProfile(profile, preferredOs, requireProxy))
      scored.sort((a, b) => b.score - a.score)

      const best = scored[0]
      logger.info('Selected best profile', {
        profileId: best.profile.id,
        score: best.score,
        reasons: best.reasons
      })

      return best.profile
    } catch (err) {
      logger.error('Profile selection failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Checks the health of a specific profile by running a test session.
   *
   * @param profileId - GoLogin profile ID to check.
   * @returns `true` if the profile test passes.
   */
  async checkHealth(profileId: string): Promise<boolean> {
    try {
      const result = await GoLoginService.getInstance().testSession(profileId)
      return result.passed
    } catch (err) {
      logger.error('Profile health check failed', {
        profileId,
        error: err instanceof Error ? err.message : String(err)
      })
      return false
    }
  }

  /**
   * Returns the count of currently active sessions.
   */
  getActiveSessionCount(): number {
    return 0
  }

  private scoreProfile(
    profile: GoLoginProfile,
    preferredOs?: GoLoginProfile['os'],
    requireProxy = false
  ): ScoredProfile {
    let score = 0
    const reasons: string[] = []

    if (profile.status === 'ready') {
      score += 10
      reasons.push('profile is ready')
    }

    if (preferredOs && profile.os === preferredOs) {
      score += 5
      reasons.push(`matches preferred OS: ${preferredOs}`)
    }

    const hasProxy = profile.proxy.mode !== 'none'
    if (requireProxy && hasProxy) {
      score += 5
      reasons.push('has proxy configured')
    } else if (requireProxy && !hasProxy) {
      score -= 10
      reasons.push('missing required proxy')
    }

    if (hasProxy) {
      score += 2
      reasons.push('proxy available')
    }

    return { profile, score, reasons }
  }
}
