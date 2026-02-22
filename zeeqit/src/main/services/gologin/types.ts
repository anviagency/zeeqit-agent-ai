/**
 * GoLogin service type definitions.
 *
 * Describes browser profile structures and session management data
 * for the GoLogin anti-detect browser integration.
 */

/** Operating system type for a GoLogin browser profile. */
export type ProfileOS = 'win' | 'mac' | 'lin' | 'android'

/** Status of a GoLogin browser profile. */
export type ProfileStatus = 'ready' | 'running' | 'updating' | 'error'

/** Proxy configuration for a GoLogin profile. */
export interface ProfileProxy {
  mode: 'none' | 'http' | 'socks4' | 'socks5'
  host?: string
  port?: number
  username?: string
  password?: string
}

/** A GoLogin browser profile descriptor. */
export interface GoLoginProfile {
  /** Unique GoLogin profile identifier. */
  id: string
  /** Human-readable profile name. */
  name: string
  /** Operating system fingerprint. */
  os: ProfileOS
  /** Proxy configuration for this profile. */
  proxy: ProfileProxy
  /** Current profile status. */
  status: ProfileStatus
}

/** Active browser session information. */
export interface SessionInfo {
  /** GoLogin profile ID this session belongs to. */
  profileId: string
  /** Chrome DevTools Protocol WebSocket URL. */
  cdpUrl: string
  /** OS process ID of the browser instance. */
  pid: number
  /** ISO timestamp of when the session was started. */
  startedAt: string
}

/** Result of a session test/verification. */
export interface SessionTestResult {
  /** Whether the session test passed. */
  passed: boolean
  /** Profile ID that was tested. */
  profileId: string
  /** Human-readable test result message. */
  message: string
  /** Time taken to run the test in milliseconds. */
  durationMs: number
}
