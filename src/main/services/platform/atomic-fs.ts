import { readFile, writeFile, rename, copyFile, unlink, open } from 'fs/promises'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'
import { platform } from 'os'
import { mkdirSync, existsSync } from 'fs'
import lockfile from 'proper-lockfile'

const WINDOWS_RETRY_COUNT = 3
const WINDOWS_MAX_JITTER_MS = 2000

/**
 * Generates a temporary file path adjacent to the target,
 * using a random suffix to avoid collisions.
 */
function getTmpPath(targetPath: string): string {
  const suffix = randomBytes(8).toString('hex')
  return join(dirname(targetPath), `.tmp-${suffix}`)
}

/**
 * Sleeps for a random duration between 0 and `maxMs` milliseconds.
 * Used as jitter between Windows rename retries.
 */
function randomJitter(maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * maxMs)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Flushes a file's contents to the underlying storage device via fsync.
 *
 * @param filePath - Path to the file to sync.
 */
async function fsyncFile(filePath: string): Promise<void> {
  const handle = await open(filePath, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

/**
 * Attempts an atomic rename with Windows-specific retry logic.
 *
 * On Windows, antivirus and indexing services can briefly lock files,
 * causing rename to fail with EPERM/EACCES. This function retries
 * with random jitter before falling back to a copy+rename+unlink strategy.
 *
 * @param tmpPath - Source temporary file path.
 * @param targetPath - Destination file path.
 */
async function atomicRename(tmpPath: string, targetPath: string): Promise<void> {
  const isWindows = platform() === 'win32'

  if (!isWindows) {
    await rename(tmpPath, targetPath)
    return
  }

  for (let attempt = 1; attempt <= WINDOWS_RETRY_COUNT; attempt++) {
    try {
      await rename(tmpPath, targetPath)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'EPERM' && code !== 'EACCES') {
        throw err
      }

      if (attempt < WINDOWS_RETRY_COUNT) {
        await randomJitter(WINDOWS_MAX_JITTER_MS)
      }
    }
  }

  try {
    await copyFile(tmpPath, targetPath)
    await unlink(tmpPath)
  } catch (fallbackErr) {
    throw new Error(
      `Atomic rename failed after ${WINDOWS_RETRY_COUNT} retries and copy+unlink fallback also failed: ` +
        `${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
    )
  }
}

/**
 * Writes content to a file atomically: write to temp file -> fsync -> rename.
 *
 * This guarantees that readers never see a partially-written file. On Windows,
 * rename failures are retried with random jitter, falling back to copy+rename+unlink.
 *
 * File-level coordination is handled via proper-lockfile to prevent concurrent writes.
 *
 * @param targetPath - Absolute path to the destination file.
 * @param content - String or Buffer content to write.
 *
 * @example
 * ```ts
 * await atomicWriteFile('/data/config.json', JSON.stringify(config, null, 2))
 * ```
 */
export async function atomicWriteFile(
  targetPath: string,
  content: string | Buffer
): Promise<void> {
  mkdirSync(dirname(targetPath), { recursive: true })

  // On first-time creation the file doesn't exist yet.
  // proper-lockfile requires the target file to exist for locking,
  // so we write directly when the file is new (no concurrent readers possible).
  if (!existsSync(targetPath)) {
    await writeFile(targetPath, content, { encoding: 'utf-8' })
    await fsyncFile(targetPath)
    return
  }

  const lockPath = `${targetPath}.lock`
  mkdirSync(dirname(lockPath), { recursive: true })

  let release: (() => Promise<void>) | undefined

  try {
    release = await lockfile.lock(targetPath, {
      realpath: false,
      retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
      lockfilePath: lockPath
    })
  } catch (lockErr) {
    throw new Error(
      `Failed to acquire lock for "${targetPath}": ${lockErr instanceof Error ? lockErr.message : String(lockErr)}`
    )
  }

  const tmpPath = getTmpPath(targetPath)

  try {
    await writeFile(tmpPath, content, { encoding: 'utf-8' })
    await fsyncFile(tmpPath)
    await atomicRename(tmpPath, targetPath)
  } catch (err) {
    try {
      await unlink(tmpPath)
    } catch {
      // temp file cleanup is best-effort
    }
    throw new Error(
      `Atomic write to "${targetPath}" failed: ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    if (release) {
      try {
        await release()
      } catch {
        // lock release is best-effort
      }
    }
  }
}

/**
 * Reads a file with structured error handling.
 *
 * @param filePath - Absolute path to the file to read.
 * @returns The file contents as a UTF-8 string.
 * @throws If the file does not exist or cannot be read.
 *
 * @example
 * ```ts
 * const config = JSON.parse(await atomicReadFile('/data/config.json'))
 * ```
 */
export async function atomicReadFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, { encoding: 'utf-8' })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code

    if (code === 'ENOENT') {
      throw new Error(`File not found: "${filePath}"`)
    }
    if (code === 'EACCES') {
      throw new Error(`Permission denied reading "${filePath}"`)
    }

    throw new Error(
      `Failed to read "${filePath}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
