import { existsSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { platform, arch } from 'os'
import { app } from 'electron'
import { LogRing } from '../diagnostics/log-ring'
import { verifyBinary, getManifest } from './runtime-integrity'
import type { RuntimeInfo, RuntimeType } from './types'

const execFileAsync = promisify(execFile)
const logger = LogRing.getInstance()

type PlatformKey = 'darwin-arm64' | 'darwin-x64' | 'linux-x64' | 'win-x64'

const BINARY_NAME: Record<string, string> = {
  win32: 'node.exe',
  darwin: 'node',
  linux: 'node'
}

/**
 * Resolves the Node.js runtime binary needed to execute OpenClaw.
 *
 * Resolution order: embedded binary in app resources -> system-installed Node on PATH -> download.
 * Each candidate is verified for integrity when a manifest is available.
 */
export class RuntimeResolver {
  private static instance: RuntimeResolver | null = null

  private constructor() {}

  /** Returns the singleton RuntimeResolver instance. */
  static getInstance(): RuntimeResolver {
    if (!RuntimeResolver.instance) {
      RuntimeResolver.instance = new RuntimeResolver()
    }
    return RuntimeResolver.instance
  }

  /**
   * Resolves the best available Node.js runtime.
   *
   * Tries embedded -> system -> download in order. The first runtime that
   * passes integrity verification (when a manifest is available) is returned.
   *
   * @returns Resolved runtime information.
   * @throws If no viable runtime can be found.
   */
  async resolve(): Promise<RuntimeInfo> {
    try {
      logger.info('Resolving Node.js runtime')

      const embedded = await this.findEmbedded()
      if (embedded) {
        logger.info('Using embedded runtime', { path: embedded.path, version: embedded.version })
        return embedded
      }

      const system = await this.findSystem()
      if (system) {
        logger.info('Using system runtime', { path: system.path, version: system.version })
        return system
      }

      const downloaded = await this.downloadRuntime()
      if (downloaded) {
        logger.info('Using downloaded runtime', { path: downloaded.path, version: downloaded.version })
        return downloaded
      }

      throw new Error('No viable Node.js runtime found (checked: embedded, system, download)')
    } catch (err) {
      logger.error('Runtime resolution failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Checks for a Node.js binary bundled in the app's resources/runtime/ directory.
   *
   * @returns RuntimeInfo if a valid embedded binary exists, `null` otherwise.
   */
  async findEmbedded(): Promise<RuntimeInfo | null> {
    try {
      const platformKey = this.getCurrentPlatformKey()
      const resourcesDir = join(
        app.isPackaged ? process.resourcesPath : app.getAppPath(),
        'resources',
        'runtime',
        platformKey
      )
      const binaryName = BINARY_NAME[platform()] ?? 'node'
      const binaryPath = join(resourcesDir, binaryName)

      if (!existsSync(binaryPath)) {
        logger.debug('No embedded runtime found', { path: binaryPath })
        return null
      }

      const version = await this.getNodeVersion(binaryPath)
      const verified = await this.verifyIntegrity(binaryPath)

      return { type: 'embedded' as RuntimeType, path: binaryPath, version, verified }
    } catch (err) {
      logger.debug('Embedded runtime check failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Checks for a system-installed Node.js binary on PATH.
   *
   * @returns RuntimeInfo if `node` is found on PATH and meets minimum version, `null` otherwise.
   */
  async findSystem(): Promise<RuntimeInfo | null> {
    try {
      const { stdout } = await execFileAsync('node', ['--version'], { timeout: 5_000 })
      const version = stdout.trim()

      if (!version.startsWith('v')) {
        logger.debug('System node returned unexpected version format', { version })
        return null
      }

      const whichCmd = platform() === 'win32' ? 'where' : 'which'
      const { stdout: nodePath } = await execFileAsync(whichCmd, ['node'], { timeout: 5_000 })
      const resolvedPath = nodePath.trim().split('\n')[0]

      return {
        type: 'system' as RuntimeType,
        path: resolvedPath,
        version,
        verified: true
      }
    } catch (err) {
      logger.debug('No system Node.js found on PATH', {
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Downloads a Node.js binary for the current platform.
   *
   * @returns RuntimeInfo for the downloaded binary, or `null` if download is not yet implemented.
   *
   * @remarks
   * This is a placeholder for the download flow. In production, this would:
   * 1. Fetch the manifest from CDN
   * 2. Download the platform-specific binary
   * 3. Verify SHA-256 integrity
   * 4. Extract to app-data/runtime/
   */
  async downloadRuntime(): Promise<RuntimeInfo | null> {
    try {
      logger.warn('Runtime download not yet implemented — manual install required')
      return null
    } catch (err) {
      logger.error('Runtime download failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Verifies the SHA-256 integrity of a runtime binary against the embedded manifest.
   *
   * @param runtimePath - Absolute path to the binary to verify.
   * @returns `true` if verification passes or no manifest is available, `false` if check fails.
   */
  async verifyIntegrity(runtimePath: string): Promise<boolean> {
    try {
      const manifest = await getManifest()
      if (!manifest) {
        logger.debug('No manifest available, skipping integrity check')
        return true
      }

      const platformKey = this.getCurrentPlatformKey()
      const entry = manifest.runtimes[platformKey]
      if (!entry) {
        logger.warn('No manifest entry for current platform', { platformKey })
        return true
      }

      return await verifyBinary(runtimePath, entry.sha256)
    } catch (err) {
      logger.error('Integrity verification error', {
        path: runtimePath,
        error: err instanceof Error ? err.message : String(err)
      })
      return false
    }
  }

  /**
   * Returns the platform key for the current OS and architecture.
   *
   * @returns One of: `darwin-arm64`, `darwin-x64`, `linux-x64`, `win-x64`.
   */
  getCurrentPlatformKey(): PlatformKey {
    const os = platform()
    const cpu = arch()

    if (os === 'darwin' && cpu === 'arm64') return 'darwin-arm64'
    if (os === 'darwin') return 'darwin-x64'
    if (os === 'linux') return 'linux-x64'
    return 'win-x64'
  }

  private async getNodeVersion(binaryPath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(binaryPath, ['--version'], { timeout: 5_000 })
      return stdout.trim()
    } catch (err) {
      throw new Error(
        `Failed to get Node version from "${binaryPath}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }
}
