import { join } from 'path'
import { existsSync } from 'fs'
import { LogRing } from '../diagnostics/log-ring'
import { getOpenClawPath } from '../platform/app-paths'
import { atomicWriteFile, atomicReadFile } from '../platform/atomic-fs'
import { OpenClawConfigSchema, type OpenClawConfig } from '@shared/schemas/openclaw-config.schema'
import { ConfigBackup } from './config-backup'

const logger = LogRing.getInstance()
const CONFIG_FILENAME = 'openclaw.json'

/**
 * Compiles, validates, and manages the OpenClaw configuration file.
 *
 * Handles conversion from Zeeqit UI state to OpenClaw's native config format,
 * validation via Zod schema, atomic writes with automatic backups, and
 * diff/rollback support.
 */
export class ConfigCompiler {
  private static instance: ConfigCompiler | null = null

  private constructor() {}

  /** Returns the singleton ConfigCompiler instance. */
  static getInstance(): ConfigCompiler {
    if (!ConfigCompiler.instance) {
      ConfigCompiler.instance = new ConfigCompiler()
    }
    return ConfigCompiler.instance
  }

  /**
   * Compiles Zeeqit application state into a validated OpenClaw configuration.
   *
   * @param zeeqitState - Raw state object from the Zeeqit UI or installer.
   * @returns Validated OpenClaw configuration object.
   * @throws If the compiled config fails Zod schema validation.
   */
  compile(zeeqitState: Record<string, unknown>): OpenClawConfig {
    try {
      logger.info('Compiling OpenClaw configuration from Zeeqit state')

      const rawConfig = this.mapStateToConfig(zeeqitState)
      const result = OpenClawConfigSchema.safeParse(rawConfig)

      if (!result.success) {
        const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        throw new Error(`Config validation failed:\n${issues.join('\n')}`)
      }

      logger.info('Configuration compiled and validated successfully')
      return result.data
    } catch (err) {
      logger.error('Config compilation failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Full apply pipeline: validate -> backup current -> atomic write -> log.
   *
   * @param config - Raw or compiled configuration to apply.
   * @throws If validation fails or the write operation fails.
   */
  async apply(config: Record<string, unknown>): Promise<void> {
    try {
      logger.info('Applying new OpenClaw configuration')

      const validated = this.compile(config)
      const configPath = this.getConfigPath()

      if (existsSync(configPath)) {
        const current = await this.getCurrentConfig()
        if (current) {
          await ConfigBackup.getInstance().backup(current)
          logger.info('Current config backed up before applying new config')
        }
      }

      const serialized = JSON.stringify(validated, null, 2)
      await atomicWriteFile(configPath, serialized)

      logger.info('OpenClaw configuration applied successfully')
    } catch (err) {
      logger.error('Failed to apply OpenClaw configuration', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Computes a JSON diff between the proposed config and the current on-disk config.
   *
   * @param newConfig - Proposed configuration object.
   * @returns JSON string describing the differences, or `null` if configs are identical.
   */
  async diff(newConfig: Record<string, unknown>): Promise<string | null> {
    try {
      const compiled = this.compile(newConfig)
      const current = await this.getCurrentConfig()

      if (!current) {
        return JSON.stringify({ type: 'new', config: compiled }, null, 2)
      }

      const changes = this.computeDiff(current, compiled)

      if (Object.keys(changes).length === 0) {
        return null
      }

      return JSON.stringify(changes, null, 2)
    } catch (err) {
      logger.error('Config diff failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Restores a previous configuration from a backup.
   *
   * @param backupId - Timestamp-based backup identifier.
   * @throws If the backup cannot be found or restored.
   */
  async rollback(backupId: string): Promise<void> {
    try {
      logger.info('Rolling back to config backup', { backupId })

      const backup = await ConfigBackup.getInstance().loadBackup(backupId)
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`)
      }

      await this.apply(backup as Record<string, unknown>)
      logger.info('Configuration rolled back successfully', { backupId })
    } catch (err) {
      logger.error('Config rollback failed', {
        backupId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Reads the current OpenClaw configuration from disk.
   *
   * @returns Parsed configuration, or `null` if no config file exists.
   */
  async getCurrentConfig(): Promise<OpenClawConfig | null> {
    try {
      const configPath = this.getConfigPath()

      if (!existsSync(configPath)) {
        return null
      }

      const raw = await atomicReadFile(configPath)
      const parsed = JSON.parse(raw)
      const result = OpenClawConfigSchema.safeParse(parsed)

      if (!result.success) {
        logger.warn('On-disk config failed validation', {
          issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        })
        return parsed as OpenClawConfig
      }

      return result.data
    } catch (err) {
      logger.error('Failed to read current OpenClaw config', {
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  private getConfigPath(): string {
    return join(getOpenClawPath(), CONFIG_FILENAME)
  }

  private mapStateToConfig(state: Record<string, unknown>): Record<string, unknown> {
    return {
      identity: state['identity'] ?? {},
      agents: {
        defaults: {
          workspace: (state['workspace'] as string) ?? '~/.openclaw/workspace',
          model: {
            primary: (state['models'] as Record<string, unknown>)?.['primary'] ?? 'claude-sonnet-4-20250514',
            fallbacks: (state['models'] as Record<string, unknown>)?.['fallbacks'] ?? []
          },
          thinkingDefault: (state['thinkingDefault'] as string) ?? 'low',
          maxConcurrent: (state['maxConcurrent'] as number) ?? 3,
          timeoutSeconds: (state['timeoutSeconds'] as number) ?? 600
        }
      },
      channels: state['channels'] ?? {},
      tools: state['tools'] ?? {},
      skills: state['skills'] ?? {},
      gateway: state['gateway'] ?? {}
    }
  }

  private computeDiff(
    current: Record<string, unknown>,
    next: Record<string, unknown>,
    prefix = ''
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {}

    const allKeys = new Set([...Object.keys(current), ...Object.keys(next)])

    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key
      const oldVal = current[key]
      const newVal = next[key]

      if (oldVal === newVal) continue

      if (
        typeof oldVal === 'object' &&
        typeof newVal === 'object' &&
        oldVal !== null &&
        newVal !== null &&
        !Array.isArray(oldVal) &&
        !Array.isArray(newVal)
      ) {
        const nested = this.computeDiff(
          oldVal as Record<string, unknown>,
          newVal as Record<string, unknown>,
          path
        )
        Object.assign(changes, nested)
      } else {
        changes[path] = { from: oldVal, to: newVal }
      }
    }

    return changes
  }
}
