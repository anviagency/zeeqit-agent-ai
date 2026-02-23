import { ipcMain } from 'electron'
import { IpcChannels, type IpcResult } from '@shared/ipc-channels'
import { LogRing } from '../services/diagnostics/log-ring'

const logger = LogRing.getInstance()

type IpcHandler = (...args: unknown[]) => Promise<IpcResult>

function wrapHandler(channel: string, handler: IpcHandler): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`IPC handler error [${channel}]`, { error: message })
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
          details: err instanceof Error ? err.stack : undefined
        }
      } satisfies IpcResult
    }
  })
}

function ok<T>(data?: T): IpcResult<T> {
  return { success: true, data }
}

function fail(code: string, message: string): IpcResult {
  return { success: false, error: { code, message } }
}

/**
 * Registers all IPC handlers for the main process.
 * Each domain will be expanded as services are implemented.
 */
export function registerAllIpcHandlers(): void {
  logger.info('Registering IPC handlers')

  // OpenClaw
  wrapHandler(IpcChannels.OPENCLAW_INSTALL, async (config) => {
    const { OpenClawInstaller } = await import('../services/openclaw/installer')
    const installer = OpenClawInstaller.getInstance()
    await installer.install(config as Record<string, unknown>)
    return ok()
  })

  wrapHandler(IpcChannels.OPENCLAW_GET_STATUS, async () => {
    const { OpenClawInstaller } = await import('../services/openclaw/installer')
    const checkpoint = OpenClawInstaller.getInstance().getCheckpoint()
    return ok(checkpoint)
  })

  wrapHandler(IpcChannels.OPENCLAW_REPAIR, async () => {
    const { OpenClawInstaller } = await import('../services/openclaw/installer')
    const report = await OpenClawInstaller.getInstance().repair()
    return ok(report)
  })

  // Daemon
  wrapHandler(IpcChannels.DAEMON_START, async () => {
    const { DaemonManager } = await import('../services/openclaw/daemon')
    await DaemonManager.getInstance().start()
    return ok()
  })

  wrapHandler(IpcChannels.DAEMON_STOP, async () => {
    const { DaemonManager } = await import('../services/openclaw/daemon')
    await DaemonManager.getInstance().stop()
    return ok()
  })

  wrapHandler(IpcChannels.DAEMON_RESTART, async () => {
    const { DaemonManager } = await import('../services/openclaw/daemon')
    await DaemonManager.getInstance().restart()
    return ok()
  })

  wrapHandler(IpcChannels.DAEMON_LOGS, async (count) => {
    const logEntries = LogRing.getInstance().getEntries(count as number | undefined)
    return ok(logEntries.map((e) => `[${e.timestamp}] [${e.level}] ${e.message}`))
  })

  wrapHandler(IpcChannels.DAEMON_STATUS, async () => {
    const { DaemonManager } = await import('../services/openclaw/daemon')
    const status = await DaemonManager.getInstance().getStatus()
    return ok(status)
  })

  // Config
  wrapHandler(IpcChannels.CONFIG_GET, async () => {
    const { ConfigCompiler } = await import('../services/openclaw/config-compiler')
    const config = await ConfigCompiler.getInstance().getCurrentConfig()
    return ok(config)
  })

  wrapHandler(IpcChannels.CONFIG_APPLY, async (config) => {
    const { ConfigCompiler } = await import('../services/openclaw/config-compiler')
    await ConfigCompiler.getInstance().apply(config as Record<string, unknown>)
    return ok()
  })

  wrapHandler(IpcChannels.CONFIG_DIFF, async (config) => {
    const { ConfigCompiler } = await import('../services/openclaw/config-compiler')
    const diff = await ConfigCompiler.getInstance().diff(config as Record<string, unknown>)
    return ok(diff)
  })

  wrapHandler(IpcChannels.CONFIG_ROLLBACK, async (backupId) => {
    const { ConfigCompiler } = await import('../services/openclaw/config-compiler')
    await ConfigCompiler.getInstance().rollback(backupId as string)
    return ok()
  })

  wrapHandler(IpcChannels.CONFIG_LIST_BACKUPS, async () => {
    const { ConfigBackup } = await import('../services/openclaw/config-backup')
    const backups = await ConfigBackup.getInstance().listBackups()
    return ok(backups)
  })

  // Vault
  wrapHandler(IpcChannels.VAULT_STORE, async (service, key, value) => {
    const { CredentialStore } = await import('../services/vault/credential-store')
    await CredentialStore.getInstance().store(
      service as string,
      key as string,
      value as string
    )
    return ok()
  })

  wrapHandler(IpcChannels.VAULT_GET, async (service, key) => {
    const { CredentialStore } = await import('../services/vault/credential-store')
    const value = await CredentialStore.getInstance().get(
      service as string,
      key as string
    )
    return ok(value)
  })

  wrapHandler(IpcChannels.VAULT_DELETE, async (service, key) => {
    const { CredentialStore } = await import('../services/vault/credential-store')
    await CredentialStore.getInstance().delete(service as string, key as string)
    return ok()
  })

  wrapHandler(IpcChannels.VAULT_LIST, async () => {
    const { CredentialStore } = await import('../services/vault/credential-store')
    const entries = await CredentialStore.getInstance().list()
    return ok(entries)
  })

  wrapHandler(IpcChannels.VAULT_ROTATE, async () => {
    const { CredentialStore } = await import('../services/vault/credential-store')
    await CredentialStore.getInstance().rotateKey()
    return ok()
  })

  wrapHandler(IpcChannels.VAULT_STATUS, async () => {
    const { CredentialStore } = await import('../services/vault/credential-store')
    const status = await CredentialStore.getInstance().getStatus()
    return ok(status)
  })

  // Gateway
  wrapHandler(IpcChannels.GATEWAY_CONNECT, async () => {
    const { GatewayWebSocketClient } = await import('../services/gateway/websocket-client')
    await GatewayWebSocketClient.getInstance().connect()
    return ok()
  })

  wrapHandler(IpcChannels.GATEWAY_DISCONNECT, async () => {
    const { GatewayWebSocketClient } = await import('../services/gateway/websocket-client')
    GatewayWebSocketClient.getInstance().disconnect()
    return ok()
  })

  wrapHandler(IpcChannels.GATEWAY_STATUS, async () => {
    const { GatewayWebSocketClient } = await import('../services/gateway/websocket-client')
    const status = GatewayWebSocketClient.getInstance().getState()
    return ok(status)
  })

  wrapHandler(IpcChannels.GATEWAY_RPC, async (method, params) => {
    const { GatewayRpc } = await import('../services/gateway/rpc')
    const result = await GatewayRpc.getInstance().call(
      method as string,
      params as Record<string, unknown> | undefined
    )
    return ok(result)
  })

  // GoLogin
  wrapHandler(IpcChannels.GOLOGIN_VALIDATE, async (token) => {
    const { GoLoginService } = await import('../services/gologin/client')
    const valid = await GoLoginService.getInstance().validateToken(token as string)
    return ok(valid)
  })

  wrapHandler(IpcChannels.GOLOGIN_LIST_PROFILES, async () => {
    const { GoLoginService } = await import('../services/gologin/client')
    const profiles = await GoLoginService.getInstance().listProfiles()
    return ok(profiles)
  })

  wrapHandler(IpcChannels.GOLOGIN_LAUNCH, async (profileId) => {
    const { GoLoginService } = await import('../services/gologin/client')
    const cdpUrl = await GoLoginService.getInstance().launchProfile(profileId as string)
    return ok(cdpUrl)
  })

  wrapHandler(IpcChannels.GOLOGIN_STOP, async (profileId) => {
    const { GoLoginService } = await import('../services/gologin/client')
    await GoLoginService.getInstance().stopProfile(profileId as string)
    return ok()
  })

  wrapHandler(IpcChannels.GOLOGIN_TEST_SESSION, async (profileId) => {
    const { GoLoginService } = await import('../services/gologin/client')
    const result = await GoLoginService.getInstance().testSession(profileId as string)
    return ok(result)
  })

  // Apify
  wrapHandler(IpcChannels.APIFY_VALIDATE, async (token) => {
    const { ApifyService } = await import('../services/apify/client')
    const valid = await ApifyService.getInstance().validateToken(token as string)
    return ok(valid)
  })

  wrapHandler(IpcChannels.APIFY_LIST_ACTORS, async () => {
    const { ApifyService } = await import('../services/apify/client')
    const actors = await ApifyService.getInstance().listActors()
    return ok(actors)
  })

  wrapHandler(IpcChannels.APIFY_RUN, async (actorId, input) => {
    const { ActorRunner } = await import('../services/apify/actor-runner')
    const result = await ActorRunner.getInstance().run(
      actorId as string,
      input as Record<string, unknown>
    )
    return ok(result)
  })

  wrapHandler(IpcChannels.APIFY_STATUS, async (runId) => {
    const { ActorRunner } = await import('../services/apify/actor-runner')
    const status = await ActorRunner.getInstance().getRunStatus(runId as string)
    return ok(status)
  })

  // Evidence
  wrapHandler(IpcChannels.EVIDENCE_GET_CHAIN, async (workflowRunId) => {
    const { EvidenceChain } = await import('../services/evidence/chain')
    const chain = await EvidenceChain.getInstance().getChain(workflowRunId as string)
    return ok(chain)
  })

  wrapHandler(IpcChannels.EVIDENCE_VERIFY, async (chainId) => {
    const { EvidenceChain } = await import('../services/evidence/chain')
    const result = await EvidenceChain.getInstance().verify(chainId as string)
    return ok(result)
  })

  wrapHandler(IpcChannels.EVIDENCE_EXPORT, async (chainId) => {
    const { EvidenceChain } = await import('../services/evidence/chain')
    const path = await EvidenceChain.getInstance().exportChain(chainId as string)
    return ok(path)
  })

  // Routing
  wrapHandler(IpcChannels.ROUTING_EXECUTE, async (params) => {
    const { RoutingEngine } = await import('../services/routing/engine')
    const result = await RoutingEngine.getInstance().execute(
      params as Record<string, unknown>
    )
    return ok(result)
  })

  wrapHandler(IpcChannels.ROUTING_GET_CONFIG, async () => {
    const { RoutingEngine } = await import('../services/routing/engine')
    const config = RoutingEngine.getInstance().getConfig()
    return ok(config)
  })

  wrapHandler(IpcChannels.ROUTING_SET_CONFIG, async (config) => {
    const { RoutingEngine } = await import('../services/routing/engine')
    RoutingEngine.getInstance().setConfig(config as Record<string, unknown>)
    return ok()
  })

  // Workflow
  wrapHandler(IpcChannels.WORKFLOW_CREATE, async (workflow) => {
    return ok(workflow)
  })

  wrapHandler(IpcChannels.WORKFLOW_EXECUTE, async (workflowId) => {
    return fail('NOT_IMPLEMENTED', `Workflow execution for ${workflowId} not yet implemented`)
  })

  wrapHandler(IpcChannels.WORKFLOW_LIST, async () => {
    return ok([])
  })

  wrapHandler(IpcChannels.WORKFLOW_GET, async (workflowId) => {
    return fail('NOT_FOUND', `Workflow ${workflowId} not found`)
  })

  wrapHandler(IpcChannels.WORKFLOW_SCHEDULE, async () => {
    return fail('NOT_IMPLEMENTED', 'Workflow scheduling not yet implemented')
  })

  // Diagnostics
  wrapHandler(IpcChannels.DIAGNOSTICS_EXPORT, async () => {
    const { createDiagnosticBundle } = await import('../services/diagnostics/bundle')
    const bundlePath = await createDiagnosticBundle()
    return ok(bundlePath)
  })

  wrapHandler(IpcChannels.DIAGNOSTICS_HEALTH, async () => {
    const { HealthMonitor } = await import('../services/openclaw/health')
    const result = await HealthMonitor.getInstance().evaluate()
    return ok(result)
  })

  logger.info('All IPC handlers registered')
}
