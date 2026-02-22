/**
 * Health monitor for the OpenClaw daemon and gateway ecosystem.
 *
 * Runs a suite of health checks (process alive, gateway port open, WebSocket
 * handshake, heartbeat freshness, config version match, GoLogin integration)
 * and tracks consecutive failures to trigger auto-repair when the threshold
 * is exceeded.
 */

import { createConnection, type Socket } from 'net'
import { LogRing } from '../diagnostics/log-ring'
import {
  HEALTH_CHECK_IDS,
  AUTO_REPAIR_THRESHOLD,
  HEARTBEAT_MAX_AGE_MS,
  type HealthContractResult,
  type HealthCheckResult
} from '@shared/health-contract'

const GATEWAY_HOST = '127.0.0.1'
const GATEWAY_PORT = 18789
const TCP_CONNECT_TIMEOUT_MS = 5_000

/**
 * Singleton health monitor that evaluates the state of the OpenClaw system.
 *
 * @example
 * ```ts
 * const monitor = HealthMonitor.getInstance()
 * const result = await monitor.evaluate()
 * if (result.overall === 'red') {
 *   // handle degraded state
 * }
 * ```
 */
export class HealthMonitor {
  private static instance: HealthMonitor | null = null
  private readonly logger = LogRing.getInstance()
  private consecutiveFailures = 0
  private daemonPid: number | null = null
  private expectedConfigVersion: string | null = null
  private goLoginEnabled = false

  private constructor() {}

  /**
   * Returns the singleton HealthMonitor instance.
   */
  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor()
    }
    return HealthMonitor.instance
  }

  /**
   * Sets the daemon PID to monitor.
   *
   * @param pid - OS process ID of the daemon.
   */
  setDaemonPid(pid: number | null): void {
    this.daemonPid = pid
  }

  /**
   * Sets the expected configuration version for version-match checks.
   *
   * @param version - Semantic version string.
   */
  setExpectedConfigVersion(version: string): void {
    this.expectedConfigVersion = version
  }

  /**
   * Enables or disables GoLogin health checks.
   *
   * @param enabled - Whether GoLogin integration is active.
   */
  setGoLoginEnabled(enabled: boolean): void {
    this.goLoginEnabled = enabled
  }

  /**
   * Runs all health checks and returns a composite result.
   *
   * If all required checks pass, overall is 'green'. If any required check
   * fails, overall is 'red'. After {@link AUTO_REPAIR_THRESHOLD} consecutive
   * red evaluations, auto-repair is triggered.
   *
   * @returns A {@link HealthContractResult} with individual check results.
   */
  async evaluate(): Promise<HealthContractResult> {
    try {
      const checks: HealthCheckResult[] = []

      const [processCheck, portCheck] = await Promise.all([
        this.checkProcessAlive(),
        this.checkGatewayPortOpen()
      ])
      checks.push(processCheck, portCheck)

      if (portCheck.passed) {
        const wsCheck = await this.checkWsHandshake()
        checks.push(wsCheck)
      } else {
        checks.push({
          id: HEALTH_CHECK_IDS.WS_HANDSHAKE,
          name: 'WebSocket Handshake',
          passed: false,
          message: 'Skipped: gateway port not open',
          required: true
        })
      }

      checks.push(await this.checkHeartbeatFresh())
      checks.push(await this.checkConfigVersionMatch())

      if (this.goLoginEnabled) {
        checks.push(
          await this.checkGoLoginTokenValid(),
          await this.checkGoLoginProfileExists()
        )
      }

      const allRequiredPass = checks.filter((c) => c.required).every((c) => c.passed)
      const overall = allRequiredPass ? 'green' : 'red'

      if (overall === 'red') {
        this.consecutiveFailures += 1
      } else {
        this.consecutiveFailures = 0
      }

      const result: HealthContractResult = {
        overall,
        checks,
        evaluatedAt: new Date().toISOString(),
        consecutiveFailures: this.consecutiveFailures
      }

      this.logger.info(`Health evaluation: ${overall}`, {
        consecutiveFailures: this.consecutiveFailures,
        failedChecks: checks.filter((c) => !c.passed).map((c) => c.id)
      })

      if (this.consecutiveFailures >= AUTO_REPAIR_THRESHOLD) {
        this.logger.warn(
          `Auto-repair threshold reached (${this.consecutiveFailures} consecutive failures)`
        )
        await this.triggerAutoRepair()
      }

      return result
    } catch (err) {
      this.consecutiveFailures += 1
      this.logger.error('Health evaluation failed', {
        error: err instanceof Error ? err.message : String(err)
      })

      return {
        overall: 'red',
        checks: [
          {
            id: 'evaluation_error',
            name: 'Evaluation Error',
            passed: false,
            message: err instanceof Error ? err.message : String(err),
            required: true
          }
        ],
        evaluatedAt: new Date().toISOString(),
        consecutiveFailures: this.consecutiveFailures
      }
    }
  }

  private async checkProcessAlive(): Promise<HealthCheckResult> {
    try {
      if (this.daemonPid === null) {
        return {
          id: HEALTH_CHECK_IDS.PROCESS_ALIVE,
          name: 'Process Alive',
          passed: false,
          message: 'No daemon PID registered',
          required: true
        }
      }

      const alive = this.isProcessRunning(this.daemonPid)
      return {
        id: HEALTH_CHECK_IDS.PROCESS_ALIVE,
        name: 'Process Alive',
        passed: alive,
        message: alive
          ? `Daemon PID ${this.daemonPid} is running`
          : `Daemon PID ${this.daemonPid} is not running`,
        required: true
      }
    } catch (err) {
      return {
        id: HEALTH_CHECK_IDS.PROCESS_ALIVE,
        name: 'Process Alive',
        passed: false,
        message: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
        required: true
      }
    }
  }

  private async checkGatewayPortOpen(): Promise<HealthCheckResult> {
    try {
      const open = await this.tryTcpConnect(GATEWAY_HOST, GATEWAY_PORT)
      return {
        id: HEALTH_CHECK_IDS.GATEWAY_PORT_OPEN,
        name: 'Gateway Port Open',
        passed: open,
        message: open
          ? `Port ${GATEWAY_PORT} is accepting connections`
          : `Port ${GATEWAY_PORT} is not reachable`,
        required: true
      }
    } catch (err) {
      return {
        id: HEALTH_CHECK_IDS.GATEWAY_PORT_OPEN,
        name: 'Gateway Port Open',
        passed: false,
        message: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
        required: true
      }
    }
  }

  private async checkWsHandshake(): Promise<HealthCheckResult> {
    try {
      const { GatewayWebSocketClient } = await import('../gateway/websocket-client')
      const client = GatewayWebSocketClient.getInstance()
      const connected = client.getState() === 'connected'

      return {
        id: HEALTH_CHECK_IDS.WS_HANDSHAKE,
        name: 'WebSocket Handshake',
        passed: connected,
        message: connected
          ? 'WebSocket connection active'
          : 'WebSocket not connected',
        required: true
      }
    } catch (err) {
      return {
        id: HEALTH_CHECK_IDS.WS_HANDSHAKE,
        name: 'WebSocket Handshake',
        passed: false,
        message: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
        required: true
      }
    }
  }

  private async checkHeartbeatFresh(): Promise<HealthCheckResult> {
    try {
      const { GatewayWebSocketClient } = await import('../gateway/websocket-client')
      const client = GatewayWebSocketClient.getInstance()
      const lastHeartbeat = client.getLastHeartbeat()

      if (!lastHeartbeat) {
        return {
          id: HEALTH_CHECK_IDS.HEARTBEAT_FRESH,
          name: 'Heartbeat Fresh',
          passed: false,
          message: 'No heartbeat recorded',
          required: true
        }
      }

      const age = Date.now() - new Date(lastHeartbeat).getTime()
      const fresh = age < HEARTBEAT_MAX_AGE_MS

      return {
        id: HEALTH_CHECK_IDS.HEARTBEAT_FRESH,
        name: 'Heartbeat Fresh',
        passed: fresh,
        message: fresh
          ? `Last heartbeat ${Math.round(age / 1000)}s ago`
          : `Heartbeat stale: ${Math.round(age / 1000)}s old (max ${HEARTBEAT_MAX_AGE_MS / 1000}s)`,
        required: true
      }
    } catch (err) {
      return {
        id: HEALTH_CHECK_IDS.HEARTBEAT_FRESH,
        name: 'Heartbeat Fresh',
        passed: false,
        message: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
        required: true
      }
    }
  }

  private async checkConfigVersionMatch(): Promise<HealthCheckResult> {
    try {
      if (!this.expectedConfigVersion) {
        return {
          id: HEALTH_CHECK_IDS.CONFIG_VERSION_MATCH,
          name: 'Config Version Match',
          passed: true,
          message: 'No expected version set, skipping',
          required: false
        }
      }

      const { GatewayRpc } = await import('../gateway/rpc')
      const rpc = GatewayRpc.getInstance()
      const config = (await rpc.configGet()) as { version?: string } | null

      const remoteVersion = config?.version ?? null
      const match = remoteVersion === this.expectedConfigVersion

      return {
        id: HEALTH_CHECK_IDS.CONFIG_VERSION_MATCH,
        name: 'Config Version Match',
        passed: match,
        message: match
          ? `Config version matches: ${remoteVersion}`
          : `Version mismatch: expected ${this.expectedConfigVersion}, got ${remoteVersion}`,
        required: true
      }
    } catch (err) {
      return {
        id: HEALTH_CHECK_IDS.CONFIG_VERSION_MATCH,
        name: 'Config Version Match',
        passed: false,
        message: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
        required: true
      }
    }
  }

  private async checkGoLoginTokenValid(): Promise<HealthCheckResult> {
    try {
      const { CredentialStore } = await import('../vault/credential-store')
      const store = CredentialStore.getInstance()
      const token = await store.get('gologin', 'api-token')

      return {
        id: HEALTH_CHECK_IDS.GOLOGIN_TOKEN_VALID,
        name: 'GoLogin Token Valid',
        passed: token !== null && token.length > 0,
        message: token ? 'GoLogin API token is present' : 'GoLogin API token missing',
        required: false
      }
    } catch (err) {
      return {
        id: HEALTH_CHECK_IDS.GOLOGIN_TOKEN_VALID,
        name: 'GoLogin Token Valid',
        passed: false,
        message: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
        required: false
      }
    }
  }

  private async checkGoLoginProfileExists(): Promise<HealthCheckResult> {
    try {
      const { CredentialStore } = await import('../vault/credential-store')
      const store = CredentialStore.getInstance()
      const profileId = await store.get('gologin', 'profile-id')

      return {
        id: HEALTH_CHECK_IDS.GOLOGIN_PROFILE_EXISTS,
        name: 'GoLogin Profile Exists',
        passed: profileId !== null && profileId.length > 0,
        message: profileId
          ? `GoLogin profile configured: ${profileId.slice(0, 8)}...`
          : 'GoLogin profile not configured',
        required: false
      }
    } catch (err) {
      return {
        id: HEALTH_CHECK_IDS.GOLOGIN_PROFILE_EXISTS,
        name: 'GoLogin Profile Exists',
        passed: false,
        message: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
        required: false
      }
    }
  }

  /**
   * Checks whether a process with the given PID is running by sending signal 0.
   */
  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  /**
   * Attempts a TCP connection to verify a port is accepting connections.
   */
  private tryTcpConnect(host: string, port: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let socket: Socket | null = null

      const timer = setTimeout(() => {
        if (socket) {
          socket.destroy()
        }
        resolve(false)
      }, TCP_CONNECT_TIMEOUT_MS)

      try {
        socket = createConnection({ host, port }, () => {
          clearTimeout(timer)
          socket?.destroy()
          resolve(true)
        })

        socket.on('error', () => {
          clearTimeout(timer)
          resolve(false)
        })
      } catch {
        clearTimeout(timer)
        resolve(false)
      }
    })
  }

  /**
   * Triggers auto-repair by delegating to the OpenClaw installer.
   * Resets the consecutive failure counter after attempting repair.
   */
  private async triggerAutoRepair(): Promise<void> {
    try {
      this.logger.warn('Triggering auto-repair')
      const { OpenClawInstaller } = await import('./installer')
      await OpenClawInstaller.getInstance().repair()
      this.consecutiveFailures = 0
      this.logger.info('Auto-repair completed')
    } catch (err) {
      this.logger.error('Auto-repair failed', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
}
