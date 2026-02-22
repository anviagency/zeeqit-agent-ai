import { platform } from 'os'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { LogRing } from '../diagnostics/log-ring'
import { getOpenClawPath } from '../platform/app-paths'
import type { DaemonStatus } from './types'

const logger = LogRing.getInstance()
const FORCE_KILL_TIMEOUT_MS = 10_000
const PID_FILE = 'daemon.pid'

interface PlatformAdapter {
  install(nodePath: string, openclawPath: string): Promise<void>
  uninstall(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  isInstalled(): boolean | Promise<boolean>
}

/**
 * Manages the OpenClaw daemon lifecycle across macOS, Linux, and Windows.
 *
 * Delegates platform-specific operations (launchd, systemd, schtasks) to
 * dedicated adapters while providing a unified API for start/stop/restart/status.
 */
export class DaemonManager {
  private static instance: DaemonManager | null = null
  private adapter: PlatformAdapter | null = null
  private startTime: Date | null = null

  private constructor() {}

  /** Returns the singleton DaemonManager instance. */
  static getInstance(): DaemonManager {
    if (!DaemonManager.instance) {
      DaemonManager.instance = new DaemonManager()
    }
    return DaemonManager.instance
  }

  /**
   * Starts the OpenClaw daemon via the platform-specific service manager.
   *
   * @throws If the platform adapter fails to start the daemon.
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting OpenClaw daemon')
      const adapter = await this.getPlatformAdapter()
      await adapter.start()
      this.startTime = new Date()
      logger.info('OpenClaw daemon started')
    } catch (err) {
      logger.error('Failed to start OpenClaw daemon', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Stops the OpenClaw daemon gracefully.
   * If the daemon doesn't stop within 10 seconds, falls back to SIGKILL.
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping OpenClaw daemon')
      const adapter = await this.getPlatformAdapter()

      const stopPromise = adapter.stop()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Daemon stop timed out, attempting force kill')),
          FORCE_KILL_TIMEOUT_MS
        )
      )

      try {
        await Promise.race([stopPromise, timeoutPromise])
      } catch (timeoutErr) {
        logger.warn('Graceful stop timed out, force killing daemon')
        await this.forceKill()
      }

      this.startTime = null
      logger.info('OpenClaw daemon stopped')
    } catch (err) {
      logger.error('Failed to stop OpenClaw daemon', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Restarts the daemon by performing a stop followed by a start.
   */
  async restart(): Promise<void> {
    try {
      logger.info('Restarting OpenClaw daemon')
      await this.stop()
      await this.start()
      logger.info('OpenClaw daemon restarted')
    } catch (err) {
      logger.error('Daemon restart failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Returns a status snapshot of the daemon process.
   *
   * @returns Current daemon status including PID, uptime, and platform info.
   */
  async getStatus(): Promise<DaemonStatus> {
    try {
      const pid = this.readPidFile()
      const running = pid !== null && this.isPidAlive(pid)
      const uptime = running && this.startTime
        ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
        : 0

      return {
        running,
        pid: running ? pid : null,
        uptime,
        lastRestart: this.startTime?.toISOString() ?? null,
        platform: platform(),
        configVersion: await this.readConfigVersion()
      }
    } catch (err) {
      logger.error('Failed to get daemon status', {
        error: err instanceof Error ? err.message : String(err)
      })
      return {
        running: false,
        pid: null,
        uptime: 0,
        lastRestart: null,
        platform: platform(),
        configVersion: 'unknown'
      }
    }
  }

  /**
   * Checks whether the daemon process is currently alive by examining the PID file.
   *
   * @returns `true` if the daemon PID is alive, `false` otherwise.
   */
  async isRunning(): Promise<boolean> {
    try {
      const pid = this.readPidFile()
      return pid !== null && this.isPidAlive(pid)
    } catch (err) {
      logger.debug('isRunning check failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return false
    }
  }

  /**
   * Returns the platform-specific daemon adapter (launchd, systemd, or winsvc).
   *
   * @returns The loaded platform adapter.
   * @throws If the current platform is unsupported.
   */
  async getPlatformAdapter(): Promise<PlatformAdapter> {
    if (this.adapter) return this.adapter

    try {
      const os = platform()

      switch (os) {
        case 'darwin': {
          const { LaunchdAdapter } = await import('./daemon-platform/launchd')
          this.adapter = LaunchdAdapter
          break
        }
        case 'linux': {
          const { SystemdAdapter } = await import('./daemon-platform/systemd')
          this.adapter = SystemdAdapter
          break
        }
        case 'win32': {
          const { WinSvcAdapter } = await import('./daemon-platform/winsvc')
          this.adapter = WinSvcAdapter
          break
        }
        default:
          throw new Error(`Unsupported platform for daemon management: ${os}`)
      }

      return this.adapter!
    } catch (err) {
      logger.error('Failed to load platform adapter', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  private readPidFile(): number | null {
    try {
      const pidPath = join(getOpenClawPath(), PID_FILE)
      if (!existsSync(pidPath)) return null

      const raw = readFileSync(pidPath, 'utf-8').trim()
      const pid = parseInt(raw, 10)
      return isNaN(pid) ? null : pid
    } catch {
      return null
    }
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  private async forceKill(): Promise<void> {
    const pid = this.readPidFile()
    if (pid === null) return

    try {
      process.kill(pid, 'SIGKILL')
      logger.info('Daemon force-killed', { pid })
    } catch (err) {
      logger.warn('Force kill failed (process may have already exited)', {
        pid,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  private async readConfigVersion(): Promise<string> {
    try {
      const configPath = join(getOpenClawPath(), 'openclaw.json')
      if (!existsSync(configPath)) return 'none'
      const raw = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(raw)
      return config.version ?? config.gateway?.reload?.mode ?? '1.0.0'
    } catch {
      return 'unknown'
    }
  }
}
