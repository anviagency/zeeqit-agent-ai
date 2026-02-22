/**
 * Formal health contract definition.
 *
 * Health = GREEN if and only if ALL checks pass.
 * Auto-repair triggers after 3 consecutive failures (1 minute apart).
 */

export interface HealthContractResult {
  overall: 'green' | 'red'
  checks: HealthCheckResult[]
  evaluatedAt: string
  consecutiveFailures: number
}

export interface HealthCheckResult {
  id: string
  name: string
  passed: boolean
  message: string
  required: boolean
}

export const HEALTH_CHECK_IDS = {
  PROCESS_ALIVE: 'process_alive',
  GATEWAY_PORT_OPEN: 'gateway_port_open',
  WS_HANDSHAKE: 'ws_handshake',
  HEARTBEAT_FRESH: 'heartbeat_fresh',
  CONFIG_VERSION_MATCH: 'config_version_match',
  GOLOGIN_TOKEN_VALID: 'gologin_token_valid',
  GOLOGIN_PROFILE_EXISTS: 'gologin_profile_exists'
} as const

export const AUTO_REPAIR_THRESHOLD = 3
export const HEALTH_CHECK_INTERVAL_MS = 60_000
export const HEARTBEAT_MAX_AGE_MS = 60_000
