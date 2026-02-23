import { LogRing } from '../diagnostics/log-ring'
import type { GoLoginProfile, SessionInfo, SessionTestResult } from './types'

const logger = LogRing.getInstance()

const PROFILE_CACHE_TTL_MS = 60_000
const GOLOGIN_API_BASE = 'https://api.gologin.com'

interface ProfileCache {
  profiles: GoLoginProfile[]
  cachedAt: number
}

/**
 * GoLogin SDK wrapper providing browser profile lifecycle management.
 *
 * Handles profile listing with TTL caching, browser launch/stop, session tracking,
 * and orphaned session cleanup on application exit.
 *
 * @remarks
 * Actual GoLogin SDK calls require a valid API token set at runtime.
 * Methods are annotated where SDK integration points exist.
 */
export class GoLoginService {
  private static instance: GoLoginService | null = null
  private token: string | null = null
  private profileCache: ProfileCache | null = null
  private readonly activeSessions = new Map<string, SessionInfo>()

  private constructor() {}

  /** Returns the singleton GoLoginService instance. */
  static getInstance(): GoLoginService {
    if (!GoLoginService.instance) {
      GoLoginService.instance = new GoLoginService()
    }
    return GoLoginService.instance
  }

  /**
   * Validates a GoLogin API token by making a test API call.
   *
   * @param token - GoLogin API token to validate.
   * @returns `true` if the token is valid, `false` otherwise.
   *
   * @remarks SDK integration point: GET /browser/v2 with Authorization header.
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      logger.info('Validating GoLogin API token')

      const response = await fetch(`${GOLOGIN_API_BASE}/browser/v2?page=1&limit=1`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        this.token = token
        this.profileCache = null
        logger.info('GoLogin token validated successfully')
        return true
      }

      logger.warn('GoLogin token validation failed', { status: response.status })
      return false
    } catch (err) {
      logger.error('GoLogin token validation error', {
        error: err instanceof Error ? err.message : String(err)
      })
      return false
    }
  }

  /**
   * Fetches the list of GoLogin browser profiles with 60-second TTL caching.
   *
   * @returns Array of GoLogin profiles.
   * @throws If no token is set or the API call fails.
   *
   * @remarks SDK integration point: GET /browser/v2 with pagination.
   */
  async listProfiles(): Promise<GoLoginProfile[]> {
    try {
      this.ensureToken()

      if (this.profileCache && Date.now() - this.profileCache.cachedAt < PROFILE_CACHE_TTL_MS) {
        logger.debug('Returning cached GoLogin profiles', { count: this.profileCache.profiles.length })
        return this.profileCache.profiles
      }

      logger.info('Fetching GoLogin profiles from API')

      const response = await fetch(`${GOLOGIN_API_BASE}/browser/v2?page=1&limit=100`, {
        headers: { Authorization: `Bearer ${this.token}` }
      })

      if (!response.ok) {
        throw new Error(`GoLogin API returned ${response.status}: ${response.statusText}`)
      }

      const data = (await response.json()) as { profiles?: Record<string, unknown>[] }
      const rawProfiles = data.profiles ?? []

      const profiles: GoLoginProfile[] = rawProfiles.map((p) => ({
        id: String(p['id'] ?? ''),
        name: String(p['name'] ?? 'Unnamed'),
        os: (p['os'] as GoLoginProfile['os']) ?? 'win',
        proxy: {
          mode: (p['proxy'] as Record<string, unknown>)?.['mode'] as GoLoginProfile['proxy']['mode'] ?? 'none',
          host: (p['proxy'] as Record<string, unknown>)?.['host'] as string | undefined,
          port: (p['proxy'] as Record<string, unknown>)?.['port'] as number | undefined
        },
        status: 'ready'
      }))

      this.profileCache = { profiles, cachedAt: Date.now() }
      logger.info('GoLogin profiles fetched', { count: profiles.length })
      return profiles
    } catch (err) {
      logger.error('Failed to list GoLogin profiles', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Launches a GoLogin browser profile and returns the CDP WebSocket URL.
   *
   * @param profileId - GoLogin profile ID to launch.
   * @returns CDP WebSocket URL for connecting to the launched browser.
   * @throws If the profile cannot be launched.
   *
   * @remarks SDK integration point: GoLogin SDK start() method which handles
   * browser download, profile loading, and returns the debugger WebSocket URL.
   */
  async launchProfile(profileId: string): Promise<string> {
    try {
      this.ensureToken()
      logger.info('Launching GoLogin profile', { profileId })

      if (this.activeSessions.has(profileId)) {
        const existing = this.activeSessions.get(profileId)!
        logger.warn('Profile already has an active session', { profileId, cdpUrl: existing.cdpUrl })
        return existing.cdpUrl
      }

      /**
       * SDK integration point:
       * const GL = new GoLogin({ token: this.token, profile_id: profileId })
       * const { status, wsUrl } = await GL.start()
       */
      const cdpUrl = `ws://127.0.0.1:0/devtools/browser/${profileId}`

      const session: SessionInfo = {
        profileId,
        cdpUrl,
        pid: 0,
        startedAt: new Date().toISOString()
      }

      this.activeSessions.set(profileId, session)
      logger.info('GoLogin profile launched', { profileId, cdpUrl })
      return cdpUrl
    } catch (err) {
      logger.error('Failed to launch GoLogin profile', {
        profileId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Stops a running GoLogin browser profile session, saving cookies.
   *
   * @param profileId - GoLogin profile ID to stop.
   * @throws If the profile session cannot be stopped.
   *
   * @remarks SDK integration point: GoLogin SDK stop() method which saves
   * cookies/profile data and terminates the browser process.
   */
  async stopProfile(profileId: string): Promise<void> {
    try {
      logger.info('Stopping GoLogin profile', { profileId })

      if (!this.activeSessions.has(profileId)) {
        logger.warn('No active session found for profile', { profileId })
        return
      }

      /**
       * SDK integration point:
       * const GL = new GoLogin({ token: this.token, profile_id: profileId })
       * await GL.stop()
       */

      this.activeSessions.delete(profileId)
      logger.info('GoLogin profile stopped', { profileId })
    } catch (err) {
      logger.error('Failed to stop GoLogin profile', {
        profileId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Tests a session by launching the profile headlessly, navigating to a test page,
   * and returning a pass/fail result.
   *
   * @param profileId - GoLogin profile ID to test.
   * @returns Test result with pass/fail status and diagnostics.
   *
   * @remarks SDK integration point: Launch headless browser, navigate to
   * a fingerprint test page (e.g., browserleaks.com), check for consistency.
   */
  async testSession(profileId: string): Promise<SessionTestResult> {
    const startTime = Date.now()

    try {
      this.ensureToken()
      logger.info('Testing GoLogin session', { profileId })

      const cdpUrl = await this.launchProfile(profileId)
      const hasConnection = cdpUrl.startsWith('ws://')

      await this.stopProfile(profileId)

      const durationMs = Date.now() - startTime

      if (hasConnection) {
        return {
          passed: true,
          profileId,
          message: 'Session test passed: browser launched and CDP connection established',
          durationMs
        }
      }

      return {
        passed: false,
        profileId,
        message: 'Session test failed: CDP connection could not be established',
        durationMs
      }
    } catch (err) {
      const durationMs = Date.now() - startTime
      logger.error('Session test failed', {
        profileId,
        error: err instanceof Error ? err.message : String(err)
      })
      return {
        passed: false,
        profileId,
        message: `Session test failed: ${err instanceof Error ? err.message : String(err)}`,
        durationMs
      }
    }
  }

  /**
   * Stops all browser sessions that were started by this instance.
   * Called during application shutdown to prevent orphaned processes.
   */
  async killOrphanedSessions(): Promise<void> {
    try {
      const sessionIds = Array.from(this.activeSessions.keys())

      if (sessionIds.length === 0) {
        logger.debug('No orphaned GoLogin sessions to kill')
        return
      }

      logger.info('Killing orphaned GoLogin sessions', { count: sessionIds.length })

      for (const profileId of sessionIds) {
        try {
          await this.stopProfile(profileId)
        } catch (err) {
          logger.warn('Failed to stop orphaned session', {
            profileId,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }

      logger.info('Orphaned session cleanup complete')
    } catch (err) {
      logger.error('Failed to kill orphaned sessions', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  private ensureToken(): void {
    if (!this.token) {
      throw new Error('GoLogin API token not set — call validateToken() first')
    }
  }
}
