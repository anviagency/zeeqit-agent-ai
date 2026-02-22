import { mkdirSync } from 'fs'
import { join } from 'path'
import { homedir, platform } from 'os'

const APP_NAME = 'Zeeqit'
const APP_NAME_LOWER = 'zeeqit'

/**
 * Resolves the platform-specific base directory for application data.
 *
 * - macOS:   ~/Library/Application Support/Zeeqit/
 * - Windows: %APPDATA%\Zeeqit\
 * - Linux:   ~/.local/share/zeeqit/
 *
 * @returns Absolute path to the app data root directory.
 * @throws If the current platform is unsupported.
 */
function resolveBaseDataDir(): string {
  const home = homedir()
  const os = platform()

  switch (os) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', APP_NAME)
    case 'win32':
      return join(process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming'), APP_NAME)
    case 'linux':
      return join(
        process.env['XDG_DATA_HOME'] ?? join(home, '.local', 'share'),
        APP_NAME_LOWER
      )
    default:
      throw new Error(`Unsupported platform: ${os}`)
  }
}

/**
 * Ensures a directory exists, creating it recursively if necessary.
 *
 * @param dirPath - Absolute path to the directory.
 * @returns The same path, guaranteed to exist on disk.
 */
function ensureDir(dirPath: string): string {
  try {
    mkdirSync(dirPath, { recursive: true })
  } catch (err) {
    throw new Error(
      `Failed to create directory "${dirPath}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
  return dirPath
}

let cachedBasePath: string | null = null

/**
 * Returns (and caches) the root application data path for the current OS.
 * Creates the directory on first access.
 *
 * @returns Absolute path to the app data root.
 *
 * @example
 * ```ts
 * const base = getAppDataPath()
 * // macOS  -> /Users/<user>/Library/Application Support/Zeeqit
 * // Win    -> C:\Users\<user>\AppData\Roaming\Zeeqit
 * // Linux  -> /home/<user>/.local/share/zeeqit
 * ```
 */
export function getAppDataPath(): string {
  if (!cachedBasePath) {
    cachedBasePath = ensureDir(resolveBaseDataDir())
  }
  return cachedBasePath
}

/**
 * Path to the OpenClaw runtime and configuration directory.
 *
 * @returns `<appData>/openclaw/`
 */
export function getOpenClawPath(): string {
  return ensureDir(join(getAppDataPath(), 'openclaw'))
}

/**
 * Path to the encrypted credential vault storage.
 *
 * @returns `<appData>/vault/`
 */
export function getVaultPath(): string {
  return ensureDir(join(getAppDataPath(), 'vault'))
}

/**
 * Path to configuration history / backup snapshots.
 *
 * @returns `<appData>/config-history/`
 */
export function getConfigHistoryPath(): string {
  return ensureDir(join(getAppDataPath(), 'config-history'))
}

/**
 * Path to the tamper-evidence chain storage.
 *
 * @returns `<appData>/evidence/`
 */
export function getEvidencePath(): string {
  return ensureDir(join(getAppDataPath(), 'evidence'))
}

/**
 * Path to application log files.
 *
 * @returns `<appData>/logs/`
 */
export function getLogsPath(): string {
  return ensureDir(join(getAppDataPath(), 'logs'))
}

/**
 * Path to installation checkpoint files used for crash recovery.
 *
 * @returns `<appData>/checkpoints/`
 */
export function getCheckpointPath(): string {
  return ensureDir(join(getAppDataPath(), 'checkpoints'))
}
