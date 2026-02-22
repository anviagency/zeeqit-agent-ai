/**
 * OpenClaw service type definitions.
 *
 * These interfaces describe the daemon lifecycle, runtime discovery,
 * and installer configuration used throughout the OpenClaw integration layer.
 */

/** Status snapshot of the OpenClaw daemon process. */
export interface DaemonStatus {
  /** Whether the daemon process is currently running. */
  running: boolean
  /** OS process ID, or `null` if the daemon is not running. */
  pid: number | null
  /** Daemon uptime in seconds, or `0` if not running. */
  uptime: number
  /** ISO timestamp of the last daemon restart, or `null` if never restarted. */
  lastRestart: string | null
  /** Operating system the daemon is running on. */
  platform: NodeJS.Platform
  /** Semantic version of the active configuration. */
  configVersion: string
}

/** How the OpenClaw runtime was provisioned on this machine. */
export type RuntimeType = 'embedded' | 'system' | 'downloaded'

/** Runtime binary discovery and verification result. */
export interface RuntimeInfo {
  /** How the runtime was provisioned. */
  type: RuntimeType
  /** Absolute path to the runtime binary. */
  path: string
  /** Semantic version string of the runtime. */
  version: string
  /** Whether the binary passed integrity verification (checksum / signature). */
  verified: boolean
}

/** Module toggles for the OpenClaw installer. */
export interface InstallerModules {
  /** Enable GoLogin browser automation integration. */
  goLogin: boolean
  /** Enable Telegram channel/bot integration. */
  telegram: boolean
  /** Enable Apify actor execution integration. */
  apify: boolean
}

/** Model selection for the OpenClaw agent. */
export interface InstallerModels {
  /** Primary model identifier (e.g. `"claude-sonnet-4-20250514"`). */
  primary: string
  /** Budget / fast model identifier for low-cost operations. */
  cheap: string
  /** Ordered list of fallback model identifiers if primary is unavailable. */
  fallbacks: string[]
}

/** Agent identity configuration. */
export interface InstallerIdentity {
  /** Display name for the agent. */
  name: string
  /** Visual theme key (e.g. `"dark"`, `"neon"`, `"minimal"`). */
  theme: string
  /** Emoji character used as the agent avatar. */
  emoji: string
}

/** Full set of options passed to the OpenClaw installer flow. */
export interface InstallerOptions {
  /** Which optional modules to install and enable. */
  modules: InstallerModules
  /** Model selection and fallback configuration. */
  models: InstallerModels
  /** Agent identity / branding. */
  identity: InstallerIdentity
}
