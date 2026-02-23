import { execFile } from 'child_process'
import { promisify } from 'util'
import { LogRing } from '../../diagnostics/log-ring'

const execFileAsync = promisify(execFile)
const logger = LogRing.getInstance()

const TASK_NAME = 'ZeeqitOpenClaw'
const SCHTASKS = 'schtasks.exe'

/** Windows Scheduled Task adapter for managing the OpenClaw daemon. */
export const WinSvcAdapter = {
  /**
   * Creates a Windows Scheduled Task to run the OpenClaw daemon at logon with LIMITED privileges.
   *
   * @param nodePath - Absolute path to the Node.js binary.
   * @param openclawPath - Absolute path to the OpenClaw entry point.
   */
  async install(nodePath: string, openclawPath: string): Promise<void> {
    try {
      await execFileAsync(
        SCHTASKS,
        [
          '/Create',
          '/TN', TASK_NAME,
          '/TR', `"${nodePath}" "${openclawPath}"`,
          '/SC', 'ONLOGON',
          '/RL', 'LIMITED',
          '/F'
        ],
        { timeout: 15_000 }
      )
      logger.info('Windows Scheduled Task created', { taskName: TASK_NAME })
    } catch (err) {
      logger.error('Failed to create Windows Scheduled Task', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Windows task install failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Deletes the Windows Scheduled Task.
   */
  async uninstall(): Promise<void> {
    try {
      const installed = await WinSvcAdapter.isInstalled()
      if (!installed) {
        logger.debug('Scheduled task not found, nothing to uninstall')
        return
      }

      await execFileAsync(SCHTASKS, ['/Delete', '/TN', TASK_NAME, '/F'], { timeout: 15_000 })
      logger.info('Windows Scheduled Task deleted', { taskName: TASK_NAME })
    } catch (err) {
      logger.error('Failed to delete Windows Scheduled Task', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Windows task uninstall failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Runs the Scheduled Task immediately.
   */
  async start(): Promise<void> {
    try {
      await execFileAsync(SCHTASKS, ['/Run', '/TN', TASK_NAME], { timeout: 15_000 })
      logger.info('Windows Scheduled Task started', { taskName: TASK_NAME })
    } catch (err) {
      logger.error('Failed to start Windows Scheduled Task', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Windows task start failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Ends the running Scheduled Task.
   */
  async stop(): Promise<void> {
    try {
      await execFileAsync(SCHTASKS, ['/End', '/TN', TASK_NAME], { timeout: 15_000 })
      logger.info('Windows Scheduled Task stopped', { taskName: TASK_NAME })
    } catch (err) {
      logger.error('Failed to stop Windows Scheduled Task', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Windows task stop failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },

  /**
   * Checks whether the Scheduled Task exists by querying schtasks.
   */
  async isInstalled(): Promise<boolean> {
    try {
      await execFileAsync(SCHTASKS, ['/Query', '/TN', TASK_NAME], { timeout: 10_000 })
      return true
    } catch {
      return false
    }
  }
}
