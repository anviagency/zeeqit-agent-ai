import { platform } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { LogRing } from '../diagnostics/log-ring'
import type { DaemonStatus } from './types'

const execFileAsync = promisify(execFile)
const logger = LogRing.getInstance()
const CLI_TIMEOUT_MS = 15_000
const STOP_TIMEOUT_MS = 10_000

/**
 * Manages the OpenClaw daemon lifecycle by delegating to the `openclaw` CLI.
 *
 * Uses `openclaw gateway start/stop/status` commands which correctly handle
 * the platform-specific service label (ai.openclaw.gateway on macOS,
 * openclaw-gateway on Linux, etc.) regardless of how OpenClaw was installed.
 */
export class DaemonManager {
  private static instance: DaemonManager | null = null
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
   * Starts the OpenClaw gateway daemon via `openclaw gateway start`.
   *
   * @throws If the CLI command fails.
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting OpenClaw daemon via CLI')

      await execFileAsync('openclaw', ['gateway', 'start'], {
        timeout: CLI_TIMEOUT_MS,
        env: { ...process.env }
      })

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
   * Stops the OpenClaw gateway daemon via `openclaw gateway stop`.
   * Falls back to PID-based kill if the CLI fails.
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping OpenClaw daemon via CLI')

      await execFileAsync('openclaw', ['gateway', 'stop'], {
        timeout: STOP_TIMEOUT_MS,
        env: { ...process.env }
      })

      this.startTime = null
      logger.info('OpenClaw daemon stopped')
    } catch (err) {
      logger.warn('CLI stop failed, attempting PID-based kill', {
        error: err instanceof Error ? err.message : String(err)
      })

      const status = await this.getStatus()
      if (status.running && status.pid) {
        try {
          process.kill(status.pid, 'SIGTERM')
          logger.info('Daemon killed via SIGTERM', { pid: status.pid })
        } catch (killErr) {
          logger.warn('Force kill failed', {
            error: killErr instanceof Error ? killErr.message : String(killErr)
          })
        }
      }

      this.startTime = null
    }
  }

  /**
   * Restarts the daemon by calling stop then start.
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
   * Returns a status snapshot by querying `openclaw gateway status`.
   *
   * Attempts JSON parsing first (--json flag), falls back to parsing
   * the human-readable output for "Runtime: running (pid NNNN, ...)".
   *
   * @returns Current daemon status including PID, uptime, and platform info.
   */
  async getStatus(): Promise<DaemonStatus> {
    try {
      const { stdout } = await execFileAsync(
        'openclaw',
        ['gateway', 'status', '--json'],
        { timeout: CLI_TIMEOUT_MS, env: { ...process.env } }
      )

      // Try JSON parse first
      try {
        const parsed = JSON.parse(stdout)
        return {
          running: !!parsed.running,
          pid: parsed.pid ?? null,
          uptime: parsed.uptime ?? 0,
          lastRestart: this.startTime?.toISOString() ?? null,
          platform: platform(),
          configVersion: parsed.version ?? 'unknown'
        }
      } catch {
        // Fall through to text parsing
      }

      return this.parseTextStatus(stdout)
    } catch (err) {
      // --json may not be supported, try plain text
      try {
        const { stdout } = await execFileAsync(
          'openclaw',
          ['gateway', 'status'],
          { timeout: CLI_TIMEOUT_MS, env: { ...process.env } }
        )
        return this.parseTextStatus(stdout)
      } catch {
        logger.debug('Gateway status check failed', {
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
  }

  /**
   * Checks whether the gateway daemon is currently running.
   *
   * @returns `true` if the gateway reports a running state.
   */
  async isRunning(): Promise<boolean> {
    try {
      const status = await this.getStatus()
      return status.running
    } catch {
      return false
    }
  }

  /**
   * Parses the human-readable `openclaw gateway status` output.
   *
   * Looks for patterns like:
   * - "Runtime: running (pid 12345, state active)"
   * - "Runtime: stopped"
   */
  private parseTextStatus(stdout: string): DaemonStatus {
    const runtimeMatch = stdout.match(/Runtime:\s*running\s*\(pid\s+(\d+)/)
    const running = !!runtimeMatch
    const pid = runtimeMatch ? parseInt(runtimeMatch[1], 10) : null

    return {
      running,
      pid,
      uptime: 0,
      lastRestart: this.startTime?.toISOString() ?? null,
      platform: platform(),
      configVersion: 'unknown'
    }
  }
}
