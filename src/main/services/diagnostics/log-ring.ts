import { join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { getLogsPath } from '../platform/app-paths'

/** Severity levels for log entries. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** A single structured log entry. */
export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  data?: unknown
}

const MAX_ENTRIES = 1000

/**
 * In-memory ring buffer logger that keeps the last {@link MAX_ENTRIES} log entries.
 *
 * Designed as a singleton for the main process. Entries can be flushed to disk
 * at any time for inclusion in diagnostic bundles or post-mortem analysis.
 *
 * @example
 * ```ts
 * const logger = LogRing.getInstance()
 * logger.info('Application started', { version: '1.0.0' })
 * logger.error('Connection failed', { host: 'example.com', code: 'ECONNREFUSED' })
 *
 * const recent = logger.getEntries(50) // last 50 entries
 * await logger.flush()                 // persist to disk
 * ```
 */
export class LogRing {
  private static instance: LogRing | null = null

  private readonly entries: LogEntry[] = []
  private head = 0
  private count = 0

  private constructor() {}

  /**
   * Returns the singleton LogRing instance, creating it on first access.
   */
  static getInstance(): LogRing {
    if (!LogRing.instance) {
      LogRing.instance = new LogRing()
    }
    return LogRing.instance
  }

  /**
   * Logs a debug-level message.
   *
   * @param message - Human-readable log message.
   * @param data - Optional structured data to attach.
   */
  debug(message: string, data?: unknown): void {
    this.append('debug', message, data)
  }

  /**
   * Logs an info-level message.
   *
   * @param message - Human-readable log message.
   * @param data - Optional structured data to attach.
   */
  info(message: string, data?: unknown): void {
    this.append('info', message, data)
  }

  /**
   * Logs a warning-level message.
   *
   * @param message - Human-readable log message.
   * @param data - Optional structured data to attach.
   */
  warn(message: string, data?: unknown): void {
    this.append('warn', message, data)
  }

  /**
   * Logs an error-level message.
   *
   * @param message - Human-readable log message.
   * @param data - Optional structured data (e.g. Error object, stack trace).
   */
  error(message: string, data?: unknown): void {
    this.append('error', message, data)
  }

  /**
   * Returns the most recent log entries, ordered oldest-first.
   *
   * @param count - Number of entries to return. Defaults to all stored entries.
   * @returns Array of log entries, up to `count` items.
   */
  getEntries(count?: number): LogEntry[] {
    const total = Math.min(count ?? this.count, this.count)
    const result: LogEntry[] = []

    const startIdx = (this.head - this.count + MAX_ENTRIES) % MAX_ENTRIES
    const skipCount = this.count - total

    for (let i = 0; i < total; i++) {
      const idx = (startIdx + skipCount + i) % MAX_ENTRIES
      result.push(this.entries[idx])
    }

    return result
  }

  /**
   * Persists all buffered log entries to a timestamped JSON file in the logs directory.
   *
   * @returns Absolute path to the written log file.
   * @throws If writing to disk fails.
   */
  flush(): string {
    const entries = this.getEntries()
    const logsDir = getLogsPath()

    mkdirSync(logsDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = join(logsDir, `log-ring-${timestamp}.json`)

    try {
      writeFileSync(filePath, JSON.stringify(entries, null, 2), { encoding: 'utf-8' })
    } catch (err) {
      throw new Error(
        `Failed to flush log ring to "${filePath}": ${err instanceof Error ? err.message : String(err)}`
      )
    }

    return filePath
  }

  private append(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data: data !== undefined ? this.serializeData(data) : undefined
    }

    if (this.count < MAX_ENTRIES) {
      this.entries.push(entry)
      this.count++
      this.head = this.count
    } else {
      const writeIdx = this.head % MAX_ENTRIES
      this.entries[writeIdx] = entry
      this.head = (this.head + 1) % MAX_ENTRIES
    }
  }

  /**
   * Safely serializes data for storage, converting Error instances
   * to plain objects with message and stack properties.
   */
  private serializeData(data: unknown): unknown {
    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack
      }
    }
    return data
  }
}
