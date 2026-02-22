import { join } from 'path'
import { readdir, unlink, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { LogRing } from '../diagnostics/log-ring'
import { getConfigHistoryPath } from '../platform/app-paths'
import { atomicWriteFile } from '../platform/atomic-fs'

const logger = LogRing.getInstance()
const MAX_BACKUPS = 10
const BACKUP_PREFIX = 'config-backup-'
const BACKUP_EXT = '.json'

/** Metadata about an available config backup. */
export interface BackupEntry {
  id: string
  timestamp: string
  path: string
}

/**
 * Manages FIFO backup history for OpenClaw configuration snapshots.
 *
 * Keeps at most {@link MAX_BACKUPS} backups, automatically pruning the oldest
 * entries when the limit is exceeded.
 */
export class ConfigBackup {
  private static instance: ConfigBackup | null = null

  private constructor() {}

  /** Returns the singleton ConfigBackup instance. */
  static getInstance(): ConfigBackup {
    if (!ConfigBackup.instance) {
      ConfigBackup.instance = new ConfigBackup()
    }
    return ConfigBackup.instance
  }

  /**
   * Saves a configuration snapshot to the backup history directory.
   *
   * @param config - Configuration object to back up.
   * @returns The backup identifier (ISO timestamp).
   */
  async backup(config: Record<string, unknown>): Promise<string> {
    try {
      const timestamp = new Date().toISOString()
      const safeTimestamp = timestamp.replace(/[:.]/g, '-')
      const filename = `${BACKUP_PREFIX}${safeTimestamp}${BACKUP_EXT}`
      const backupPath = join(getConfigHistoryPath(), filename)

      const payload = JSON.stringify(
        { backupTimestamp: timestamp, config },
        null,
        2
      )

      await atomicWriteFile(backupPath, payload)
      await this.pruneOldBackups()

      logger.info('Config backup created', { id: safeTimestamp })
      return safeTimestamp
    } catch (err) {
      logger.error('Failed to create config backup', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Lists all available config backups, sorted newest-first.
   *
   * @returns Array of backup entries with id, timestamp, and file path.
   */
  async listBackups(): Promise<BackupEntry[]> {
    try {
      const historyDir = getConfigHistoryPath()

      if (!existsSync(historyDir)) {
        return []
      }

      const files = await readdir(historyDir)
      const backupFiles = files
        .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith(BACKUP_EXT))
        .sort()
        .reverse()

      return backupFiles.map((f) => {
        const id = f.slice(BACKUP_PREFIX.length, -BACKUP_EXT.length)
        const timestamp = id.replace(/-/g, (match, offset: number) => {
          if (offset === 4 || offset === 7) return '-'
          if (offset === 13 || offset === 16) return ':'
          if (offset === 10) return 'T'
          if (offset === 19) return '.'
          return match
        })

        return {
          id,
          timestamp,
          path: join(historyDir, f)
        }
      })
    } catch (err) {
      logger.error('Failed to list config backups', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Loads a specific backup by its identifier.
   *
   * @param backupId - Backup identifier (safe timestamp string).
   * @returns The backed-up configuration object, or `null` if not found.
   */
  async loadBackup(backupId: string): Promise<Record<string, unknown> | null> {
    try {
      const filename = `${BACKUP_PREFIX}${backupId}${BACKUP_EXT}`
      const backupPath = join(getConfigHistoryPath(), filename)

      if (!existsSync(backupPath)) {
        logger.warn('Backup not found', { backupId })
        return null
      }

      const raw = await readFile(backupPath, 'utf-8')
      const parsed = JSON.parse(raw)

      logger.info('Config backup loaded', { backupId })
      return parsed.config ?? parsed
    } catch (err) {
      logger.error('Failed to load config backup', {
        backupId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Deletes old backups exceeding the {@link MAX_BACKUPS} limit (FIFO).
   * Oldest backups are removed first.
   */
  async pruneOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups()

      if (backups.length <= MAX_BACKUPS) {
        return
      }

      const toDelete = backups.slice(MAX_BACKUPS)

      for (const entry of toDelete) {
        try {
          await unlink(entry.path)
          logger.debug('Pruned old config backup', { id: entry.id })
        } catch (unlinkErr) {
          logger.warn('Failed to prune backup file', {
            path: entry.path,
            error: unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr)
          })
        }
      }

      logger.info(`Pruned ${toDelete.length} old config backup(s)`)
    } catch (err) {
      logger.error('Backup pruning failed', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
}
