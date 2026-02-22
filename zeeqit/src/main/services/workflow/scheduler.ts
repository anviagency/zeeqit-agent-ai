import { LogRing } from '../diagnostics/log-ring'
import { WorkflowExecutor } from './executor'
import type { ScheduleEntry } from './types'

const logger = LogRing.getInstance()
const MIN_INTERVAL_MS = 60_000

/**
 * Cron-based workflow scheduler that triggers workflow executions on a schedule.
 *
 * Manages schedule entries, evaluates cron expressions, and runs workflows
 * at the appropriate times using a polling check loop.
 */
export class WorkflowScheduler {
  private static instance: WorkflowScheduler | null = null
  private readonly schedules = new Map<string, ScheduleEntry>()
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private running = false

  private constructor() {}

  /** Returns the singleton WorkflowScheduler instance. */
  static getInstance(): WorkflowScheduler {
    if (!WorkflowScheduler.instance) {
      WorkflowScheduler.instance = new WorkflowScheduler()
    }
    return WorkflowScheduler.instance
  }

  /**
   * Registers or updates a cron schedule for a workflow.
   *
   * @param workflowId - Workflow ID to schedule.
   * @param cronExpression - Cron expression (e.g., "0 * * * *" for hourly).
   * @param timezone - IANA timezone string (default: "UTC").
   */
  schedule(workflowId: string, cronExpression: string, timezone = 'UTC'): void {
    try {
      if (!this.isValidCron(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`)
      }

      const entry: ScheduleEntry = {
        workflowId,
        cronExpression,
        enabled: true,
        lastRunAt: null,
        nextRunAt: this.computeNextRun(cronExpression),
        timezone
      }

      this.schedules.set(workflowId, entry)

      logger.info('Workflow scheduled', {
        workflowId,
        cron: cronExpression,
        nextRun: entry.nextRunAt
      })
    } catch (err) {
      logger.error('Failed to schedule workflow', {
        workflowId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Removes a workflow's schedule.
   *
   * @param workflowId - Workflow ID to unschedule.
   */
  unschedule(workflowId: string): void {
    try {
      this.schedules.delete(workflowId)
      logger.info('Workflow unscheduled', { workflowId })
    } catch (err) {
      logger.error('Failed to unschedule workflow', {
        workflowId,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  /**
   * Starts the scheduler's polling loop.
   * Checks every minute for workflows that need to be executed.
   */
  start(): void {
    try {
      if (this.running) {
        logger.warn('Scheduler is already running')
        return
      }

      this.running = true
      this.checkInterval = setInterval(() => {
        this.tick().catch((err) => {
          logger.error('Scheduler tick failed', {
            error: err instanceof Error ? err.message : String(err)
          })
        })
      }, MIN_INTERVAL_MS)

      logger.info('Workflow scheduler started', { scheduleCount: this.schedules.size })
    } catch (err) {
      logger.error('Failed to start scheduler', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Stops the scheduler's polling loop.
   */
  stop(): void {
    try {
      if (this.checkInterval) {
        clearInterval(this.checkInterval)
        this.checkInterval = null
      }

      this.running = false
      logger.info('Workflow scheduler stopped')
    } catch (err) {
      logger.error('Failed to stop scheduler', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  /**
   * Lists all registered schedule entries.
   *
   * @returns Array of schedule entries.
   */
  listSchedules(): ScheduleEntry[] {
    return Array.from(this.schedules.values())
  }

  /**
   * Gets the schedule for a specific workflow.
   *
   * @param workflowId - Workflow ID.
   * @returns Schedule entry, or `null` if not scheduled.
   */
  getSchedule(workflowId: string): ScheduleEntry | null {
    return this.schedules.get(workflowId) ?? null
  }

  /**
   * Enables or disables a workflow's schedule without removing it.
   *
   * @param workflowId - Workflow ID.
   * @param enabled - Whether the schedule should be active.
   */
  setEnabled(workflowId: string, enabled: boolean): void {
    try {
      const entry = this.schedules.get(workflowId)
      if (!entry) {
        throw new Error(`No schedule found for workflow: ${workflowId}`)
      }

      entry.enabled = enabled

      if (enabled) {
        entry.nextRunAt = this.computeNextRun(entry.cronExpression)
      }

      logger.info('Schedule updated', { workflowId, enabled })
    } catch (err) {
      logger.error('Failed to update schedule', {
        workflowId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  private async tick(): Promise<void> {
    const now = new Date()

    for (const [workflowId, entry] of this.schedules.entries()) {
      if (!entry.enabled || !entry.nextRunAt) continue

      const nextRun = new Date(entry.nextRunAt)
      if (now < nextRun) continue

      logger.info('Scheduled workflow triggered', { workflowId })

      entry.lastRunAt = now.toISOString()
      entry.nextRunAt = this.computeNextRun(entry.cronExpression)

      try {
        const executor = WorkflowExecutor.getInstance()
        await executor.execute(workflowId)
      } catch (err) {
        logger.error('Scheduled workflow execution failed', {
          workflowId,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
  }

  /**
   * Basic cron validation: checks that the expression has 5 fields.
   */
  private isValidCron(expression: string): boolean {
    const parts = expression.trim().split(/\s+/)
    return parts.length === 5
  }

  /**
   * Computes the next run time from a cron expression.
   *
   * Uses a simplified approach: for common patterns, compute the next occurrence.
   * For full cron support, a library like `cron-parser` would be used.
   */
  private computeNextRun(cronExpression: string): string {
    try {
      const parts = cronExpression.trim().split(/\s+/)
      const now = new Date()

      const minute = parts[0] === '*' ? now.getMinutes() + 1 : parseInt(parts[0], 10)
      const hour = parts[1] === '*' ? now.getHours() : parseInt(parts[1], 10)

      const next = new Date(now)
      next.setMinutes(minute)
      next.setSeconds(0)
      next.setMilliseconds(0)

      if (parts[1] !== '*') {
        next.setHours(hour)
      }

      if (next <= now) {
        if (parts[1] === '*') {
          next.setHours(next.getHours() + 1)
        } else {
          next.setDate(next.getDate() + 1)
        }
      }

      return next.toISOString()
    } catch {
      const fallback = new Date(Date.now() + MIN_INTERVAL_MS)
      return fallback.toISOString()
    }
  }
}
