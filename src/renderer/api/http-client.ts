import type { IpcResult } from '@shared/ipc-channels'

const API_PORT = 31311

function getBaseUrl(): string {
  return `http://127.0.0.1:${API_PORT}`
}

async function post<T = unknown>(path: string, body?: unknown): Promise<IpcResult<T>> {
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return await res.json()
  } catch (err) {
    return { success: false, error: { code: 'NETWORK_ERROR', message: String(err) } }
  }
}

async function get<T = unknown>(path: string): Promise<IpcResult<T>> {
  try {
    const res = await fetch(`${getBaseUrl()}${path}`)
    return await res.json()
  } catch (err) {
    return { success: false, error: { code: 'NETWORK_ERROR', message: String(err) } }
  }
}

/**
 * Browser-compatible API that uses HTTP fetch instead of Electron IPC.
 * Same interface as the preload zeeqitApi so the UI code works in both modes.
 */
export const httpApi = {
  openclaw: {
    install: (config: unknown) => post('/api/openclaw/install', config),
    getStatus: () => get('/api/openclaw/status'),
    repair: () => post('/api/openclaw/repair'),
  },

  daemon: {
    start: () => post('/api/daemon/start'),
    stop: () => post('/api/daemon/stop'),
    restart: () => post('/api/daemon/stop').then(() => post('/api/daemon/start')),
    logs: () => get<string[]>('/api/daemon/logs'),
    status: () => get('/api/daemon/status'),
  },

  config: {
    get: () => get('/api/config'),
    apply: (config: unknown) => post('/api/config/apply', config),
    diff: (config: unknown) => post('/api/config/diff', config),
    rollback: (backupId: string) => post('/api/config/rollback', { backupId }),
    listBackups: () => get('/api/config/backups'),
  },

  vault: {
    store: (service: string, key: string, value: string) =>
      post('/api/vault/store', { service, key, value }),
    get: (service: string, key: string) =>
      get(`/api/vault/get?service=${service}&key=${key}`),
    delete: (service: string, key: string) =>
      post('/api/vault/delete', { service, key }),
    list: () => get('/api/vault/list'),
    rotate: () => post('/api/vault/rotate'),
    status: () => get('/api/vault/status'),
  },

  gateway: {
    connect: () => post('/api/gateway/connect'),
    disconnect: () => post('/api/gateway/disconnect'),
    status: () => get('/api/gateway/status'),
    rpc: (method: string, params?: unknown) =>
      post('/api/gateway/rpc', { method, params }),
  },

  gologin: {
    validate: (token: string) => post('/api/gologin/validate', { token }),
    listProfiles: () => get('/api/gologin/profiles'),
    launch: (profileId: string) => post('/api/gologin/launch', { profileId }),
    stop: (profileId: string) => post('/api/gologin/stop', { profileId }),
    testSession: (profileId: string) => post('/api/gologin/test', { profileId }),
  },

  apify: {
    validate: (token: string) => post('/api/apify/validate', { token }),
    listActors: () => get('/api/apify/actors'),
    run: (actorId: string, input: unknown) => post('/api/apify/run', { actorId, input }),
    status: (runId: string) => get(`/api/apify/status/${runId}`),
  },

  evidence: {
    getChain: (workflowRunId: string) => get(`/api/evidence/chain/${workflowRunId}`),
    verify: (chainId: string) => post('/api/evidence/verify', { chainId }),
    export: (chainId: string) => post('/api/evidence/export', { chainId }),
  },

  routing: {
    execute: (params: unknown) => post('/api/routing/execute', params),
    getConfig: () => get('/api/routing/config'),
    setConfig: (config: unknown) => post('/api/routing/config', config),
  },

  workflow: {
    create: (workflow: unknown) => post('/api/workflow/create', workflow),
    generateGraph: (prompt: string) => post('/api/workflow/generate-graph', { prompt }),
    execute: (workflowId: string) => post(`/api/workflow/execute/${workflowId}`),
    list: () => get('/api/workflow/list'),
    get: (workflowId: string) => get(`/api/workflow/${workflowId}`),
    schedule: (workflowId: string, cron: string) =>
      post('/api/workflow/schedule', { workflowId, cron }),
  },

  diagnostics: {
    export: () => post('/api/diagnostics/export'),
    health: () => get('/api/diagnostics/health'),
  },

  openclawFiles: {
    getOverview: () => get('/api/openclaw/files/overview'),
    getConfig: () => get('/api/openclaw/files/config'),
    getIdentity: () => get('/api/openclaw/files/identity'),
    listWorkspace: () => get('/api/openclaw/files/workspace'),
    readWorkspaceFile: (filename: string) =>
      get(`/api/openclaw/files/workspace/${encodeURIComponent(filename)}`),
    writeWorkspaceFile: (filename: string, content: string) =>
      post(`/api/openclaw/files/workspace/${encodeURIComponent(filename)}`, { content }),
    getAgents: () => get('/api/openclaw/files/agents'),
    getCron: () => get('/api/openclaw/files/cron'),
    saveCron: (data: unknown) => post('/api/openclaw/files/cron', data),
    tailLog: (filename: string, lines = 200) =>
      get(`/api/openclaw/files/logs/${encodeURIComponent(filename)}?lines=${lines}`),
  },

  events: {
    onInstallProgress: (cb: (...args: unknown[]) => void) => {
      const eventSource = new EventSource(`${getBaseUrl()}/api/events/install-progress`)
      eventSource.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'connected') return
          cb(data)
        } catch {
          // ignore malformed events
        }
      }
      return () => {
        eventSource.close()
      }
    },
    onHealthUpdate: (_cb: (...args: unknown[]) => void) => () => {},
    onGatewayState: (cb: (...args: unknown[]) => void) => {
      // Trigger gateway connect so WebSocket is established
      post('/api/gateway/connect').catch(() => {})

      const eventSource = new EventSource(`${getBaseUrl()}/api/events/gateway-state`)
      eventSource.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'connected') return
          cb(data)
        } catch {
          // ignore malformed events
        }
      }
      return () => {
        eventSource.close()
      }
    },
    onDaemonLog: (_cb: (...args: unknown[]) => void) => () => {},
    onWorkflowProgress: (_cb: (...args: unknown[]) => void) => () => {},
  },
}
