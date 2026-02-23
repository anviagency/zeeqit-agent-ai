import { ipcRenderer } from 'electron'
import { IpcChannels, type IpcResult } from '@shared/ipc-channels'
import type { InstallCheckpoint } from '@shared/installation-states'
import type { HealthContractResult } from '@shared/health-contract'

function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, ...args)
}

function on(channel: string, callback: (...args: unknown[]) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
    callback(...args)
  }
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

export const zeeqitApi = {
  openclaw: {
    install: (config: unknown) => invoke(IpcChannels.OPENCLAW_INSTALL, config),
    getStatus: () => invoke<InstallCheckpoint>(IpcChannels.OPENCLAW_GET_STATUS),
    repair: () => invoke(IpcChannels.OPENCLAW_REPAIR)
  },

  daemon: {
    start: () => invoke(IpcChannels.DAEMON_START),
    stop: () => invoke(IpcChannels.DAEMON_STOP),
    restart: () => invoke(IpcChannels.DAEMON_RESTART),
    logs: (count?: number) => invoke<string[]>(IpcChannels.DAEMON_LOGS, count),
    status: () => invoke(IpcChannels.DAEMON_STATUS)
  },

  config: {
    get: () => invoke(IpcChannels.CONFIG_GET),
    apply: (config: unknown) => invoke(IpcChannels.CONFIG_APPLY, config),
    diff: (config: unknown) => invoke<string>(IpcChannels.CONFIG_DIFF, config),
    rollback: (backupId: string) => invoke(IpcChannels.CONFIG_ROLLBACK, backupId),
    listBackups: () => invoke(IpcChannels.CONFIG_LIST_BACKUPS)
  },

  vault: {
    store: (service: string, key: string, value: string) =>
      invoke(IpcChannels.VAULT_STORE, service, key, value),
    get: (service: string, key: string) =>
      invoke<string>(IpcChannels.VAULT_GET, service, key),
    delete: (service: string, key: string) =>
      invoke(IpcChannels.VAULT_DELETE, service, key),
    list: () => invoke(IpcChannels.VAULT_LIST),
    rotate: () => invoke(IpcChannels.VAULT_ROTATE),
    status: () => invoke(IpcChannels.VAULT_STATUS)
  },

  gateway: {
    connect: () => invoke(IpcChannels.GATEWAY_CONNECT),
    disconnect: () => invoke(IpcChannels.GATEWAY_DISCONNECT),
    status: () => invoke(IpcChannels.GATEWAY_STATUS),
    rpc: (method: string, params?: unknown) =>
      invoke(IpcChannels.GATEWAY_RPC, method, params)
  },

  gologin: {
    validate: (token: string) => invoke(IpcChannels.GOLOGIN_VALIDATE, token),
    listProfiles: () => invoke(IpcChannels.GOLOGIN_LIST_PROFILES),
    launch: (profileId: string) => invoke(IpcChannels.GOLOGIN_LAUNCH, profileId),
    stop: (profileId: string) => invoke(IpcChannels.GOLOGIN_STOP, profileId),
    testSession: (profileId: string) => invoke(IpcChannels.GOLOGIN_TEST_SESSION, profileId)
  },

  apify: {
    validate: (token: string) => invoke(IpcChannels.APIFY_VALIDATE, token),
    listActors: () => invoke(IpcChannels.APIFY_LIST_ACTORS),
    run: (actorId: string, input: unknown) => invoke(IpcChannels.APIFY_RUN, actorId, input),
    status: (runId: string) => invoke(IpcChannels.APIFY_STATUS, runId)
  },

  evidence: {
    getChain: (workflowRunId: string) => invoke(IpcChannels.EVIDENCE_GET_CHAIN, workflowRunId),
    verify: (chainId: string) => invoke(IpcChannels.EVIDENCE_VERIFY, chainId),
    export: (chainId: string) => invoke(IpcChannels.EVIDENCE_EXPORT, chainId)
  },

  routing: {
    execute: (params: unknown) => invoke(IpcChannels.ROUTING_EXECUTE, params),
    getConfig: () => invoke(IpcChannels.ROUTING_GET_CONFIG),
    setConfig: (config: unknown) => invoke(IpcChannels.ROUTING_SET_CONFIG, config)
  },

  workflow: {
    create: (workflow: unknown) => invoke(IpcChannels.WORKFLOW_CREATE, workflow),
    execute: (workflowId: string) => invoke(IpcChannels.WORKFLOW_EXECUTE, workflowId),
    list: () => invoke(IpcChannels.WORKFLOW_LIST),
    get: (workflowId: string) => invoke(IpcChannels.WORKFLOW_GET, workflowId),
    schedule: (workflowId: string, cron: string) =>
      invoke(IpcChannels.WORKFLOW_SCHEDULE, workflowId, cron)
  },

  diagnostics: {
    export: () => invoke<string>(IpcChannels.DIAGNOSTICS_EXPORT),
    health: () => invoke<HealthContractResult>(IpcChannels.DIAGNOSTICS_HEALTH)
  },

  events: {
    onInstallProgress: (cb: (...args: unknown[]) => void) =>
      on(IpcChannels.EVENT_INSTALL_PROGRESS, cb),
    onHealthUpdate: (cb: (...args: unknown[]) => void) =>
      on(IpcChannels.EVENT_HEALTH_UPDATE, cb),
    onGatewayState: (cb: (...args: unknown[]) => void) =>
      on(IpcChannels.EVENT_GATEWAY_STATE, cb),
    onDaemonLog: (cb: (...args: unknown[]) => void) =>
      on(IpcChannels.EVENT_DAEMON_LOG, cb),
    onWorkflowProgress: (cb: (...args: unknown[]) => void) =>
      on(IpcChannels.EVENT_WORKFLOW_PROGRESS, cb)
  }
}

export type ZeeqitApi = typeof zeeqitApi
