import { createHash, createVerify } from 'crypto'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { LogRing } from '../diagnostics/log-ring'

const logger = LogRing.getInstance()

/** Structure of a runtime manifest entry for a single platform. */
export interface ManifestEntry {
  url: string
  sha256: string
  version: string
  size: number
}

/** Runtime distribution manifest with Ed25519 signature. */
export interface RuntimeManifest {
  version: string
  runtimes: Record<string, ManifestEntry>
  signature: string
  publicKey: string
}

const MANIFEST_FILENAME = 'manifest.json'

/**
 * Computes SHA-256 hash of a file and compares it to the expected value.
 *
 * @param binaryPath - Absolute path to the binary to verify.
 * @param expectedHash - Hex-encoded SHA-256 digest to compare against.
 * @returns `true` if hashes match, `false` otherwise.
 */
export async function verifyBinary(binaryPath: string, expectedHash: string): Promise<boolean> {
  try {
    const data = await readFile(binaryPath)
    const actualHash = createHash('sha256').update(data).digest('hex')
    const matched = actualHash === expectedHash.toLowerCase()

    if (!matched) {
      logger.warn('Binary integrity check failed', {
        path: binaryPath,
        expected: expectedHash,
        actual: actualHash
      })
    }

    return matched
  } catch (err) {
    logger.error('Failed to verify binary integrity', {
      path: binaryPath,
      error: err instanceof Error ? err.message : String(err)
    })
    return false
  }
}

/**
 * Verifies an Ed25519 signature over the manifest data (excluding the signature field).
 *
 * @param manifestPath - Absolute path to the manifest.json file.
 * @returns `true` if the signature is valid, `false` otherwise.
 */
export async function verifyManifest(manifestPath: string): Promise<boolean> {
  try {
    const raw = await readFile(manifestPath, 'utf-8')
    const manifest: RuntimeManifest = JSON.parse(raw)

    if (!manifest.signature || !manifest.publicKey) {
      logger.warn('Manifest missing signature or public key', { path: manifestPath })
      return false
    }

    const dataToVerify = { ...manifest }
    delete (dataToVerify as Record<string, unknown>)['signature']
    const payload = JSON.stringify(dataToVerify, Object.keys(dataToVerify).sort())

    const verifier = createVerify('Ed25519')
    verifier.update(payload)
    verifier.end()

    const isValid = verifier.verify(
      { key: manifest.publicKey, format: 'pem', type: 'spki' },
      manifest.signature,
      'base64'
    )

    if (!isValid) {
      logger.warn('Manifest signature verification failed', { path: manifestPath })
    }

    return isValid
  } catch (err) {
    logger.error('Failed to verify manifest signature', {
      path: manifestPath,
      error: err instanceof Error ? err.message : String(err)
    })
    return false
  }
}

/**
 * Reads and parses the runtime manifest from the application resources directory.
 *
 * @returns Parsed manifest object, or `null` if not found or invalid.
 */
export async function getManifest(): Promise<RuntimeManifest | null> {
  try {
    const resourcesDir = join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'resources', 'runtime')
    const manifestPath = join(resourcesDir, MANIFEST_FILENAME)
    const raw = await readFile(manifestPath, 'utf-8')
    return JSON.parse(raw) as RuntimeManifest
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      logger.debug('Runtime manifest not found in resources')
      return null
    }
    logger.error('Failed to read runtime manifest', {
      error: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}
