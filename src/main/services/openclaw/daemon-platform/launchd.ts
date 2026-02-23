import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { writeFile, unlink } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdirSync } from 'fs'
import { LogRing } from '../../diagnostics/log-ring'

const execFileAsync = promisify(execFile)
const logger = LogRing.getInstance()

const PLIST_DIR = join(homedir(), 'Library', 'LaunchAgents')
const PLIST_NAME = 'com.zeeqit.openclaw.plist'
const PLIST_PATH = join(PLIST_DIR, PLIST_NAME)
const SERVICE_LABEL = 'com.zeeqit.openclaw'

/** macOS launchd adapter for managing the OpenClaw daemon as a LaunchAgent. */
export const LaunchdAdapter = {
  /**
   * Installs the LaunchAgent plist and loads it via launchctl.
   *
   * @param nodePath - Absolute path to the Node.js binary.
   * @param openclawPath - Absolute path to the OpenClaw entry point.
   */
  async install(nodePath: string, openclawPath: string): Promise<void> {
    try {
      mkdirSync(PLIST_DIR, { recursive: true })

      const plist = buildPlist(nodePath, openclawPath)
      await writeFile(PLIST_PATH, plist, 'utf-8')

      await execFileAsync('launchctl', ['load', '-w', PLIST_PATH], { timeout: 10_000 })
      logger.info('LaunchAgent installed and loaded', { path: PLIST_PATH })
    } catch (err) {
      logger.error('Failed to install LaunchAgent', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `LaunchAgent install failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Unloads and removes the LaunchAgent plist.
   */
  async uninstall(): Promise<void> {
    try {
      if (!existsSync(PLIST_PATH)) {
        logger.debug('LaunchAgent plist not found, nothing to uninstall')
        return
      }

      await execFileAsync('launchctl', ['unload', '-w', PLIST_PATH], { timeout: 10_000 })
      await unlink(PLIST_PATH)
      logger.info('LaunchAgent uninstalled', { path: PLIST_PATH })
    } catch (err) {
      logger.error('Failed to uninstall LaunchAgent', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `LaunchAgent uninstall failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Starts the LaunchAgent service via launchctl.
   */
  async start(): Promise<void> {
    try {
      await execFileAsync('launchctl', ['start', SERVICE_LABEL], { timeout: 10_000 })
      logger.info('LaunchAgent started', { label: SERVICE_LABEL })
    } catch (err) {
      logger.error('Failed to start LaunchAgent', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `LaunchAgent start failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Stops the LaunchAgent service via launchctl.
   */
  async stop(): Promise<void> {
    try {
      await execFileAsync('launchctl', ['stop', SERVICE_LABEL], { timeout: 10_000 })
      logger.info('LaunchAgent stopped', { label: SERVICE_LABEL })
    } catch (err) {
      logger.error('Failed to stop LaunchAgent', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `LaunchAgent stop failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Checks whether the LaunchAgent plist file exists on disk.
   */
  isInstalled(): boolean {
    return existsSync(PLIST_PATH)
  }
}

function buildPlist(nodePath: string, openclawPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${openclawPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${join(homedir(), 'Library', 'Logs', 'Zeeqit', 'openclaw-stdout.log')}</string>
  <key>StandardErrorPath</key>
  <string>${join(homedir(), 'Library', 'Logs', 'Zeeqit', 'openclaw-stderr.log')}</string>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>`
}
