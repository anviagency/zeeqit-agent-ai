/**
 * Type-safe IPC channel definitions shared between main and renderer processes.
 * Convention: `domain:action`
 */

export const IpcChannels = {
  // OpenClaw installer & daemon
  OPENCLAW_INSTALL: 'openclaw:install',
  OPENCLAW_GET_STATUS: 'openclaw:getStatus',
  OPENCLAW_REPAIR: 'openclaw:repair',

  // Daemon lifecycle
  DAEMON_START: 'daemon:start',
  DAEMON_STOP: 'daemon:stop',
  DAEMON_RESTART: 'daemon:restart',
  DAEMON_LOGS: 'daemon:logs',
  DAEMON_STATUS: 'daemon:status',

  // Config compiler
  CONFIG_GET: 'config:get',
  CONFIG_APPLY: 'config:apply',
  CONFIG_DIFF: 'config:diff',
  CONFIG_ROLLBACK: 'config:rollback',
  CONFIG_LIST_BACKUPS: 'config:listBackups',

  // Vault
  VAULT_STORE: 'vault:store',
  VAULT_GET: 'vault:get',
  VAULT_DELETE: 'vault:delete',
  VAULT_LIST: 'vault:list',
  VAULT_ROTATE: 'vault:rotate',
  VAULT_STATUS: 'vault:status',

  // Gateway WebSocket
  GATEWAY_CONNECT: 'gateway:connect',
  GATEWAY_DISCONNECT: 'gateway:disconnect',
  GATEWAY_STATUS: 'gateway:status',
  GATEWAY_RPC: 'gateway:rpc',

  // GoLogin
  GOLOGIN_VALIDATE: 'gologin:validate',
  GOLOGIN_LIST_PROFILES: 'gologin:listProfiles',
  GOLOGIN_LAUNCH: 'gologin:launch',
  GOLOGIN_STOP: 'gologin:stop',
  GOLOGIN_TEST_SESSION: 'gologin:testSession',

  // Apify
  APIFY_VALIDATE: 'apify:validate',
  APIFY_LIST_ACTORS: 'apify:listActors',
  APIFY_RUN: 'apify:run',
  APIFY_STATUS: 'apify:status',

  // Evidence
  EVIDENCE_GET_CHAIN: 'evidence:getChain',
  EVIDENCE_VERIFY: 'evidence:verify',
  EVIDENCE_EXPORT: 'evidence:export',

  // Routing
  ROUTING_EXECUTE: 'routing:execute',
  ROUTING_GET_CONFIG: 'routing:getConfig',
  ROUTING_SET_CONFIG: 'routing:setConfig',

  // Workflow
  WORKFLOW_CREATE: 'workflow:create',
  WORKFLOW_EXECUTE: 'workflow:execute',
  WORKFLOW_LIST: 'workflow:list',
  WORKFLOW_GET: 'workflow:get',
  WORKFLOW_SCHEDULE: 'workflow:schedule',

  // Diagnostics
  DIAGNOSTICS_EXPORT: 'diagnostics:export',
  DIAGNOSTICS_HEALTH: 'diagnostics:health',

  // Events (main -> renderer)
  EVENT_INSTALL_PROGRESS: 'event:installProgress',
  EVENT_HEALTH_UPDATE: 'event:healthUpdate',
  EVENT_GATEWAY_STATE: 'event:gatewayState',
  EVENT_DAEMON_LOG: 'event:daemonLog',
  EVENT_WORKFLOW_PROGRESS: 'event:workflowProgress'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface InstallProgressEvent {
  step: string
  status: 'running' | 'completed' | 'failed' | 'skipped'
  message: string
  progress?: number
}

export interface HealthUpdateEvent {
  lights: {
    zeeqitService: HealthLightState
    openclawGateway: HealthLightState
    browserEngine: HealthLightState
  }
}

export interface HealthLightState {
  status: 'green' | 'red' | 'yellow'
  tooltip: string
  checks: HealthCheck[]
}

export interface HealthCheck {
  name: string
  passed: boolean
  message: string
}

export interface GatewayStateEvent {
  state: 'connected' | 'disconnected' | 'reconnecting'
  attempt?: number
  lastHeartbeat?: string
}
