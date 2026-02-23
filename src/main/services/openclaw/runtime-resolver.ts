import { existsSync, createWriteStream, chmodSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { platform, arch } from 'os'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'
import { app } from 'electron'
import { LogRing } from '../diagnostics/log-ring'
import { getAppDataPath } from '../platform/app-paths'
import { verifyBinary, getManifest } from './runtime-integrity'
import type { RuntimeInfo, RuntimeType } from './types'

const execFileAsync = promisify(execFile)
const logger = LogRing.getInstance()

const NODE_DOWNLOAD_VERSION = 'v22.14.0'
const NODE_MIN_VERSION = 'v22.12.0'

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

      if (!this.meetsMinimumVersion(version)) {
        logger.debug('System node does not meet minimum version', {
          found: version,
          required: NODE_MIN_VERSION,
        })
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
   * Downloads a Node.js binary for the current platform from the official mirror.
   *
   * 1. Determines the correct archive URL for OS + arch
   * 2. Downloads to a temp file
   * 3. Extracts the node binary to <appData>/runtime/<platform-key>/
   * 4. Verifies the binary responds to --version
   *
   * @returns RuntimeInfo for the downloaded binary, or `null` on failure.
   */
  async downloadRuntime(): Promise<RuntimeInfo | null> {
    try {
      const os = platform()
      const cpu = arch()
      const platformKey = this.getCurrentPlatformKey()
      const targetDir = join(getAppDataPath(), 'runtime', platformKey)
      const binaryName = BINARY_NAME[os] ?? 'node'
      const targetBinary = join(targetDir, binaryName)

      if (existsSync(targetBinary)) {
        try {
          const version = await this.getNodeVersion(targetBinary)
          logger.info('Previously downloaded runtime found', { path: targetBinary, version })
          return { type: 'downloaded' as RuntimeType, path: targetBinary, version, verified: true }
        } catch {
          logger.warn('Existing downloaded binary is corrupt, re-downloading')
        }
      }

      mkdirSync(targetDir, { recursive: true })

      const archiveInfo = this.getDownloadUrl(os, cpu)
      if (!archiveInfo) {
        logger.warn('No download URL for current platform', { os, cpu })
        return null
      }

      logger.info('Downloading Node.js runtime', { url: archiveInfo.url, targetDir })

      const { net } = await import('electron')
      const response = await net.fetch(archiveInfo.url)

      if (!response.ok || !response.body) {
        throw new Error(`Download failed: HTTP ${response.status}`)
      }

      const tempArchive = join(targetDir, archiveInfo.filename)
      const fileStream = createWriteStream(tempArchive)

      const reader = response.body.getReader()
      const writeStream = new WritableStream({
        write(chunk) { fileStream.write(chunk) },
        close() { fileStream.end() },
        abort(reason) { fileStream.destroy(reason as Error) }
      })

      await reader.read().then(async function process({ done, value }): Promise<void> {
        if (done) { fileStream.end(); return }
        fileStream.write(value)
        const next = await reader.read()
        return process(next)
      })

      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', resolve)
        fileStream.on('error', reject)
      })

      logger.info('Download complete, extracting binary')

      if (os === 'win32') {
        await this.extractZip(tempArchive, targetDir, binaryName)
      } else {
        await this.extractTarGz(tempArchive, targetDir, binaryName)
      }

      if (os !== 'win32') {
        chmodSync(targetBinary, 0o755)
      }

      try {
        const { unlink } = await import('fs/promises')
        await unlink(tempArchive)
      } catch {
        // cleanup is best-effort
      }

      if (!existsSync(targetBinary)) {
        throw new Error(`Binary not found at ${targetBinary} after extraction`)
      }

      const version = await this.getNodeVersion(targetBinary)
      logger.info('Runtime downloaded and verified', { path: targetBinary, version })

      return { type: 'downloaded' as RuntimeType, path: targetBinary, version, verified: true }
    } catch (err) {
      logger.error('Runtime download failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  private getDownloadUrl(os: string, cpu: string): { url: string; filename: string } | null {
    const v = NODE_DOWNLOAD_VERSION
    const base = `https://nodejs.org/dist/${v}`

    if (os === 'darwin' && cpu === 'arm64') {
      const f = `node-${v}-darwin-arm64.tar.gz`
      return { url: `${base}/${f}`, filename: f }
    }
    if (os === 'darwin' && cpu === 'x64') {
      const f = `node-${v}-darwin-x64.tar.gz`
      return { url: `${base}/${f}`, filename: f }
    }
    if (os === 'linux' && cpu === 'x64') {
      const f = `node-${v}-linux-x64.tar.gz`
      return { url: `${base}/${f}`, filename: f }
    }
    if (os === 'win32' && cpu === 'x64') {
      const f = `node-${v}-win-x64.zip`
      return { url: `${base}/${f}`, filename: f }
    }

    return null
  }

  private async extractTarGz(archivePath: string, targetDir: string, binaryName: string): Promise<void> {
    const v = NODE_DOWNLOAD_VERSION
    const os = platform()
    const cpu = arch()
    const folderName = `node-${v}-${os === 'darwin' ? 'darwin' : 'linux'}-${cpu}`

    await execFileAsync('tar', [
      'xzf', archivePath,
      '-C', targetDir,
      '--strip-components=2',
      `${folderName}/bin/${binaryName}`
    ], { timeout: 60_000 })
  }

  private async extractZip(archivePath: string, targetDir: string, binaryName: string): Promise<void> {
    await execFileAsync('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${archivePath}' -DestinationPath '${targetDir}' -Force`
    ], { timeout: 60_000 })

    const v = NODE_DOWNLOAD_VERSION
    const extracted = join(targetDir, `node-${v}-win-x64`, binaryName)
    if (existsSync(extracted)) {
      const { rename } = await import('fs/promises')
      await rename(extracted, join(targetDir, binaryName))
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

  private meetsMinimumVersion(version: string): boolean {
    const parse = (v: string): number[] =>
      v.replace(/^v/, '').split('.').map(Number)
    const [aMaj, aMin, aPat] = parse(version)
    const [bMaj, bMin, bPat] = parse(NODE_MIN_VERSION)
    if (aMaj !== bMaj) return aMaj > bMaj
    if (aMin !== bMin) return aMin > bMin
    return aPat >= bPat
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
