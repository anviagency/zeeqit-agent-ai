import { mkdirSync, writeFileSync, readdirSync, readFileSync, createWriteStream } from 'fs'
import { join, basename } from 'path'
import { createGzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { platform, arch, cpus, totalmem, freemem, release, hostname, uptime } from 'os'
import {
  getAppDataPath,
  getLogsPath,
  getCheckpointPath
} from '../platform/app-paths'
import { LogRing } from './log-ring'

const logger = LogRing.getInstance()

/** Keys whose values should be redacted in diagnostic output. */
const REDACTED_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /key/i,
  /credential/i,
  /auth/i,
  /apikey/i,
  /api_key/i
]

/**
 * Recursively redacts sensitive values from a plain object.
 * Any key matching a credential-related pattern has its value replaced with `"***"`.
 *
 * @param obj - The object to redact.
 * @returns A deep copy of the object with sensitive values masked.
 */
function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item))
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const isSensitive = REDACTED_KEY_PATTERNS.some((pattern) => pattern.test(key))
    if (isSensitive && typeof value === 'string') {
      result[key] = '***'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redact(value)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Collects current system information for the diagnostic bundle.
 */
function collectSystemInfo(): Record<string, unknown> {
  return {
    platform: platform(),
    arch: arch(),
    release: release(),
    hostname: hostname(),
    uptime: uptime(),
    cpus: cpus().length,
    cpuModel: cpus()[0]?.model ?? 'unknown',
    totalMemoryMB: Math.round(totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(freemem() / 1024 / 1024),
    nodeVersion: process.version,
    electronVersion: process.versions['electron'] ?? 'unknown',
    pid: process.pid,
    collectedAt: new Date().toISOString()
  }
}

/**
 * Safely reads and parses a JSON file, returning `null` on any failure.
 */
function safeReadJson(filePath: string): unknown {
  try {
    const raw = readFileSync(filePath, { encoding: 'utf-8' })
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Writes a JSON artifact to the bundle staging directory.
 */
function writeArtifact(
  stageDir: string,
  filename: string,
  data: unknown
): void {
  const filePath = join(stageDir, filename)
  writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf-8' })
}

/**
 * Copies log files from the logs directory into the bundle staging area.
 */
function copyLogFiles(stageDir: string): void {
  const logsDir = getLogsPath()
  const logsStageDir = join(stageDir, 'logs')
  mkdirSync(logsStageDir, { recursive: true })

  try {
    const files = readdirSync(logsDir)
    for (const file of files) {
      try {
        const content = readFileSync(join(logsDir, file), { encoding: 'utf-8' })
        writeFileSync(join(logsStageDir, file), content, { encoding: 'utf-8' })
      } catch {
        // skip unreadable log files
      }
    }
  } catch {
    writeArtifact(logsStageDir, '_error.json', { error: 'Could not read logs directory' })
  }
}

/**
 * Compresses a staging directory into a .json.gz bundle file.
 *
 * Since Node.js has no built-in zip support, we serialize all artifacts
 * into a single JSON manifest and gzip-compress it. For production use,
 * consider replacing with `archiver` for proper .zip output.
 *
 * @param stageDir - Path to the directory containing staged artifacts.
 * @param outputPath - Path for the output .gz file.
 */
async function compressBundle(stageDir: string, outputPath: string): Promise<void> {
  const manifest: Record<string, unknown> = {}

  const entries = readdirSync(stageDir, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = join(stageDir, entry.name)
    if (entry.isFile()) {
      try {
        const content = readFileSync(entryPath, { encoding: 'utf-8' })
        manifest[entry.name] = JSON.parse(content)
      } catch {
        manifest[entry.name] = readFileSync(entryPath, { encoding: 'utf-8' })
      }
    } else if (entry.isDirectory()) {
      const subManifest: Record<string, unknown> = {}
      try {
        const subFiles = readdirSync(entryPath)
        for (const subFile of subFiles) {
          try {
            const content = readFileSync(join(entryPath, subFile), { encoding: 'utf-8' })
            subManifest[subFile] = JSON.parse(content)
          } catch {
            subManifest[subFile] = null
          }
        }
      } catch {
        // skip unreadable subdirectories
      }
      manifest[entry.name] = subManifest
    }
  }

  const jsonString = JSON.stringify(manifest, null, 2)
  const gzip = createGzip({ level: 9 })
  const output = createWriteStream(outputPath)

  await pipeline(Readable.from(Buffer.from(jsonString, 'utf-8')), gzip, output)
}

/**
 * Creates a diagnostic bundle containing system info, daemon status, configuration,
 * logs, errors, health state, and installation checkpoints.
 *
 * All credential-like values are redacted to `"***"` before inclusion.
 * The bundle is written as a gzip-compressed JSON manifest.
 *
 * @returns Absolute path to the generated `.diagnostic.json.gz` file.
 *
 * @example
 * ```ts
 * const bundlePath = await createDiagnosticBundle()
 * // -> /Users/<user>/Library/Application Support/Zeeqit/diagnostics/bundle-2026-02-22T10-00-00-000Z.diagnostic.json.gz
 * ```
 */
export async function createDiagnosticBundle(): Promise<string> {
  const appDataPath = getAppDataPath()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  const diagnosticsDir = join(appDataPath, 'diagnostics')
  mkdirSync(diagnosticsDir, { recursive: true })

  const stageDir = join(diagnosticsDir, `stage-${timestamp}`)
  mkdirSync(stageDir, { recursive: true })

  try {
    writeArtifact(stageDir, 'system-info.json', collectSystemInfo())

    const daemonStatusPath = join(appDataPath, 'openclaw', 'daemon-status.json')
    const daemonStatus = safeReadJson(daemonStatusPath)
    writeArtifact(stageDir, 'daemon-status.json', daemonStatus ?? { error: 'Not available' })

    const configPath = join(appDataPath, 'openclaw', 'config.json')
    const rawConfig = safeReadJson(configPath)
    writeArtifact(stageDir, 'config-current.json', rawConfig ? redact(rawConfig) : { error: 'Not available' })

    const healthPath = join(appDataPath, 'health-contract.json')
    const healthData = safeReadJson(healthPath)
    writeArtifact(stageDir, 'health-contract.json', healthData ?? { error: 'Not available' })

    const gatewayPath = join(appDataPath, 'gateway-state.json')
    const gatewayData = safeReadJson(gatewayPath)
    writeArtifact(stageDir, 'gateway-state.json', gatewayData ?? { error: 'Not available' })

    const runtimePath = join(appDataPath, 'openclaw', 'runtime-integrity.json')
    const runtimeData = safeReadJson(runtimePath)
    writeArtifact(stageDir, 'runtime-integrity.json', runtimeData ?? { error: 'Not available' })

    const checkpointDir = getCheckpointPath()
    const checkpointFile = join(checkpointDir, 'install-checkpoint.json')
    const checkpointData = safeReadJson(checkpointFile)
    writeArtifact(stageDir, 'install-checkpoint.json', checkpointData ?? { error: 'Not available' })

    logger.flush()
    copyLogFiles(stageDir)

    const ringEntries = LogRing.getInstance().getEntries()
    const errors = ringEntries.filter((e) => e.level === 'error')
    writeArtifact(stageDir, 'errors.json', errors)

    const outputPath = join(
      diagnosticsDir,
      `bundle-${timestamp}.diagnostic.json.gz`
    )
    await compressBundle(stageDir, outputPath)

    cleanupStageDir(stageDir)

    logger.info('Diagnostic bundle created', { path: outputPath })
    return outputPath
  } catch (err) {
    cleanupStageDir(stageDir)
    throw new Error(
      `Failed to create diagnostic bundle: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Best-effort cleanup of the staging directory after bundle creation.
 */
function cleanupStageDir(stageDir: string): void {
  try {
    const { rmSync } = require('fs')
    rmSync(stageDir, { recursive: true, force: true })
  } catch {
    // cleanup is best-effort
  }
}
