import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { writeFile, unlink } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { LogRing } from '../../diagnostics/log-ring'

const execFileAsync = promisify(execFile)
const logger = LogRing.getInstance()

const UNIT_DIR = join(homedir(), '.config', 'systemd', 'user')
const UNIT_NAME = 'zeeqit-openclaw.service'
const UNIT_PATH = join(UNIT_DIR, UNIT_NAME)

/** Linux systemd --user adapter for managing the OpenClaw daemon as a user service. */
export const SystemdAdapter = {
  /**
   * Installs the systemd user unit file, reloads the daemon, and enables the service.
   *
   * @param nodePath - Absolute path to the Node.js binary.
   * @param openclawPath - Absolute path to the OpenClaw entry point.
   */
  async install(nodePath: string, openclawPath: string): Promise<void> {
    try {
      mkdirSync(UNIT_DIR, { recursive: true })

      const unit = buildUnitFile(nodePath, openclawPath)
      await writeFile(UNIT_PATH, unit, 'utf-8')

      await execFileAsync('systemctl', ['--user', 'daemon-reload'], { timeout: 10_000 })
      await execFileAsync('systemctl', ['--user', 'enable', UNIT_NAME], { timeout: 10_000 })

      logger.info('Systemd user service installed and enabled', { path: UNIT_PATH })
    } catch (err) {
      logger.error('Failed to install systemd user service', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Systemd install failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Disables the service, removes the unit file, and reloads systemd.
   */
  async uninstall(): Promise<void> {
    try {
      if (!existsSync(UNIT_PATH)) {
        logger.debug('Systemd unit file not found, nothing to uninstall')
        return
      }

      try {
        await execFileAsync('systemctl', ['--user', 'stop', UNIT_NAME], { timeout: 10_000 })
      } catch {
        // Service may not be running
      }

      await execFileAsync('systemctl', ['--user', 'disable', UNIT_NAME], { timeout: 10_000 })
      await unlink(UNIT_PATH)
      await execFileAsync('systemctl', ['--user', 'daemon-reload'], { timeout: 10_000 })

      logger.info('Systemd user service uninstalled', { path: UNIT_PATH })
    } catch (err) {
      logger.error('Failed to uninstall systemd user service', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Systemd uninstall failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Starts the systemd user service.
   */
  async start(): Promise<void> {
    try {
      await execFileAsync('systemctl', ['--user', 'start', UNIT_NAME], { timeout: 10_000 })
      logger.info('Systemd user service started', { unit: UNIT_NAME })
    } catch (err) {
      logger.error('Failed to start systemd user service', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Systemd start failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Stops the systemd user service.
   */
  async stop(): Promise<void> {
    try {
      await execFileAsync('systemctl', ['--user', 'stop', UNIT_NAME], { timeout: 10_000 })
      logger.info('Systemd user service stopped', { unit: UNIT_NAME })
    } catch (err) {
      logger.error('Failed to stop systemd user service', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Systemd stop failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Checks whether the systemd unit file exists on disk.
   */
  isInstalled(): boolean {
    return existsSync(UNIT_PATH)
  }
}

function buildUnitFile(nodePath: string, openclawPath: string): string {
  return `[Unit]
Description=Zeeqit OpenClaw Daemon
After=network.target

[Service]
Type=simple
ExecStart=${nodePath} ${openclawPath}
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`
}
