import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { StatusDot } from '@/components/ui/StatusDot'

interface AgentConfig {
  name: string
  modelTier: string
  maxConcurrent: number
  status: 'active' | 'idle' | 'error'
}

const STATUS_DOT: Record<AgentConfig['status'], 'green' | 'yellow' | 'red'> = {
  active: 'green',
  idle: 'yellow',
  error: 'red'
}

const STATUS_LABEL: Record<AgentConfig['status'], string> = {
  active: 'Active',
  idle: 'Idle',
  error: 'Error'
}

/**
 * Multi-agent routing dashboard showing configured agent cards with status.
 * Phase 3 placeholder — full routing orchestration planned.
 */
export function MultiAgentView(): React.JSX.Element {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [loading, setLoading] = useState(true)

  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      const result = await window.zeeqitApi.routing.getConfig()
      if (result.success && result.data) {
        const data = result.data as { agents?: AgentConfig[] }
        setAgents(data.agents ?? [])
      }
    } catch {
      // error handling delegated to global error boundary
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-5">
        <h1 className="text-xl font-semibold text-text-main">Multi-Agent Routing</h1>
        <p className="mt-1 text-sm text-text-muted">
          Configure and monitor AI agent instances for parallel execution.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : agents.length === 0 ? (
            <EmptyAgentState />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {agents.map((agent, i) => (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <AgentCard agent={agent} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Phase note */}
          <div className="rounded-lg border border-border bg-bg-surface px-4 py-3 text-center">
            <span className="text-xs text-text-muted">
              Phase 3 — Full multi-agent routing with load balancing and failover coming soon
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: AgentConfig }): React.JSX.Element {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <AgentIcon />
          <span className="text-sm font-semibold text-text-main">{agent.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot color={STATUS_DOT[agent.status]} pulse={agent.status === 'active'} size={7} />
          <span className="text-[10px] text-text-muted">{STATUS_LABEL[agent.status]}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Row label="Model Tier" value={agent.modelTier} />
        <Row label="Max Concurrent" value={String(agent.maxConcurrent)} />
      </div>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs font-medium text-text-main">{value}</span>
    </div>
  )
}

function EmptyAgentState(): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-bg-surface">
        <AgentIcon />
      </div>
      <p className="text-sm text-text-muted">No agents configured yet.</p>
      <p className="mt-1 text-xs text-text-muted">
        Agent routing configuration will be available in the full Phase 3 release.
      </p>
    </motion.div>
  )
}

function AgentIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}
