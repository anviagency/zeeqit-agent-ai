/**
 * Service for reading/writing files in the OpenClaw home directory (~/.openclaw/).
 * Provides safe access with path traversal prevention and secret masking.
 */

import { join } from 'path'
import { readFile, stat } from 'fs/promises'
import { getOpenClawHomePath } from '../platform/app-paths'
import { atomicReadFile, atomicWriteFile } from '../platform/atomic-fs'

const WORKSPACE_FILES = [
  'SOUL.md', 'USER.md', 'IDENTITY.md', 'TOOLS.md',
  'AGENTS.md', 'HEARTBEAT.md', 'BOOTSTRAP.md',
] as const

type WorkspaceFileName = (typeof WORKSPACE_FILES)[number]

const ALLOWED_LOGS = ['gateway.log', 'gateway.err.log', 'config-audit.jsonl'] as const

/** Masks an API key: first 8 + last 4 chars visible, rest asterisks. */
function maskSecret(value: string): string {
  if (value.length <= 12) return '*'.repeat(value.length)
  return `${value.slice(0, 8)}${'*'.repeat(Math.min(value.length - 12, 32))}${value.slice(-4)}`
}

export class OpenClawFilesService {
  private static instance: OpenClawFilesService | null = null

  static getInstance(): OpenClawFilesService {
    if (!OpenClawFilesService.instance) {
      OpenClawFilesService.instance = new OpenClawFilesService()
    }
    return OpenClawFilesService.instance
  }

  private home(): string {
    return getOpenClawHomePath()
  }

  /** Read and parse ~/.openclaw/openclaw.json */
  async getConfig(): Promise<Record<string, unknown>> {
    const raw = await atomicReadFile(join(this.home(), 'openclaw.json'))
    return JSON.parse(raw)
  }

  /** Read ~/.openclaw/identity/device.json with private key redacted */
  async getIdentity(): Promise<Record<string, unknown>> {
    const raw = await atomicReadFile(join(this.home(), 'identity', 'device.json'))
    const identity = JSON.parse(raw)
    if (identity.privateKeyPem) {
      identity.privateKeyPem = '[REDACTED]'
    }
    return identity
  }

  /** List workspace .md files with their sizes */
  async listWorkspaceFiles(): Promise<Array<{ name: string; size: number }>> {
    const wsDir = join(this.home(), 'workspace')
    const results: Array<{ name: string; size: number }> = []
    for (const name of WORKSPACE_FILES) {
      try {
        const s = await stat(join(wsDir, name))
        results.push({ name, size: s.size })
      } catch {
        results.push({ name, size: 0 })
      }
    }
    return results
  }

  /** Read a specific workspace markdown file */
  async readWorkspaceFile(name: string): Promise<string> {
    if (!WORKSPACE_FILES.includes(name as WorkspaceFileName)) {
      throw new Error(`Invalid workspace file: ${name}`)
    }
    return atomicReadFile(join(this.home(), 'workspace', name))
  }

  /** Write a workspace markdown file atomically */
  async writeWorkspaceFile(name: string, content: string): Promise<void> {
    if (!WORKSPACE_FILES.includes(name as WorkspaceFileName)) {
      throw new Error(`Invalid workspace file: ${name}`)
    }
    await atomicWriteFile(join(this.home(), 'workspace', name), content)
  }

  /** Read agent auth profiles with API keys masked */
  async getAgentAuth(): Promise<Record<string, unknown>> {
    let auth: Record<string, unknown> = {}
    try {
      const raw = await atomicReadFile(
        join(this.home(), 'agents', 'main', 'agent', 'auth.json')
      )
      auth = JSON.parse(raw)
      // Mask keys in profiles
      if (auth.profiles && typeof auth.profiles === 'object') {
        for (const profile of Object.values(auth.profiles as Record<string, Record<string, unknown>>)) {
          if (typeof profile.key === 'string') {
            profile.key = maskSecret(profile.key)
          }
        }
      }
    } catch {
      // auth.json may not exist
    }

    let authProfiles: Record<string, unknown> = {}
    try {
      const raw = await atomicReadFile(
        join(this.home(), 'agents', 'main', 'agent', 'auth-profiles.json')
      )
      authProfiles = JSON.parse(raw)
    } catch {
      // auth-profiles.json may not exist
    }

    return { auth, authProfiles }
  }

  /** Read cron/jobs.json */
  async getCronJobs(): Promise<Record<string, unknown>> {
    const raw = await atomicReadFile(join(this.home(), 'cron', 'jobs.json'))
    return JSON.parse(raw)
  }

  /** Write cron/jobs.json */
  async saveCronJobs(data: Record<string, unknown>): Promise<void> {
    await atomicWriteFile(
      join(this.home(), 'cron', 'jobs.json'),
      JSON.stringify(data, null, 2)
    )
  }

  /** Read the last N lines of a log file */
  async tailLog(filename: string, lines = 200): Promise<string[]> {
    if (!ALLOWED_LOGS.includes(filename as (typeof ALLOWED_LOGS)[number])) {
      throw new Error(`Invalid log file: ${filename}`)
    }
    try {
      const content = await readFile(join(this.home(), 'logs', filename), 'utf-8')
      const allLines = content.split('\n')
      return allLines.slice(-lines)
    } catch {
      return []
    }
  }

  /** Combined overview of all OpenClaw state */
  async getOverview(): Promise<Record<string, unknown>> {
    const [config, identity, workspaceFiles, cronJobs] = await Promise.all([
      this.getConfig().catch(() => null),
      this.getIdentity().catch(() => null),
      this.listWorkspaceFiles().catch(() => []),
      this.getCronJobs().catch(() => ({ jobs: [] })),
    ])

    /* eslint-disable @typescript-eslint/no-explicit-any */
    return {
      config: config ? {
        gatewayPort: (config as any)?.gateway?.port,
        gatewayMode: (config as any)?.gateway?.mode,
        gatewayBind: (config as any)?.gateway?.bind,
        authMode: (config as any)?.gateway?.auth?.mode,
        agentModel: (config as any)?.gateway?.model,
        maxConcurrentAgents: (config as any)?.agents?.defaults?.maxConcurrent,
        maxSubagents: (config as any)?.agents?.defaults?.subagents?.maxConcurrent,
        workspace: (config as any)?.agents?.defaults?.workspace,
        lastTouchedVersion: (config as any)?.meta?.lastTouchedVersion,
        lastTouchedAt: (config as any)?.meta?.lastTouchedAt,
      } : null,
      identity: identity ? {
        deviceId: (identity as any)?.deviceId,
        publicKeyPem: (identity as any)?.publicKeyPem,
        createdAtMs: (identity as any)?.createdAtMs,
      } : null,
      workspaceFiles,
      cronJobCount: ((cronJobs as any)?.jobs ?? []).length,
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}
