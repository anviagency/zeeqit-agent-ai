import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { StatusDot } from '@/components/ui/StatusDot'
import { api } from '@/api'

interface RoutingConfig {
  defaultMode: 'auto' | 'apify' | 'browser'
  maxRetries: number
  timeoutSeconds: number
  evidenceEnabled: boolean
}

const MODE_OPTIONS = ['auto', 'apify', 'browser'] as const

/**
 * Multi-agent routing dashboard showing the real routing engine configuration.
 * Fetches config from /api/routing/config and allows live editing.
 */
export function MultiAgentView(): React.JSX.Element {
  const [config, setConfig] = useState<RoutingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      const result = await api.routing.getConfig()
      if (result.success && result.data) {
        setConfig(result.data as RoutingConfig)
      } else {
        setError(result.error?.message ?? 'Failed to load routing config')
      }
    } catch {
      setError('Failed to connect to routing engine')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const handleSave = async (): Promise<void> => {
    if (!config) return
    setSaving(true)
    try {
      const result = await api.routing.setConfig(config)
      if (!result.success) {
        setError(result.error?.message ?? 'Failed to save config')
      }
    } catch {
      setError('Failed to save routing config')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-5">
        <h1 className="text-xl font-semibold text-text-main">Multi-Agent Routing</h1>
        <p className="mt-1 text-sm text-text-muted">
          Configure the routing engine that orchestrates extraction pipelines.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : error && !config ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-bg-surface">
                <AgentIcon />
              </div>
              <p className="text-sm text-text-muted">{error}</p>
              <button
                type="button"
                onClick={() => void loadConfig()}
                className="mt-3 text-xs text-accent hover:underline"
              >
                Retry
              </button>
            </motion.div>
          ) : config ? (
            <>
              {/* Config cards */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <AgentIcon />
                        <span className="text-sm font-semibold text-text-main">Extraction Mode</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusDot color="green" pulse size={7} />
                        <span className="text-[10px] text-text-muted capitalize">{config.defaultMode}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-xs text-text-muted">Default Mode</span>
                        <select
                          value={config.defaultMode}
                          onChange={(e) => setConfig({ ...config, defaultMode: e.target.value as RoutingConfig['defaultMode'] })}
                          className="rounded-md border border-border bg-bg-surface px-2 py-1 text-xs text-text-main outline-none"
                        >
                          {MODE_OPTIONS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                >
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <AgentIcon />
                        <span className="text-sm font-semibold text-text-main">Retry Policy</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusDot color={config.maxRetries > 0 ? 'green' : 'yellow'} size={7} />
                        <span className="text-[10px] text-text-muted">{config.maxRetries} retries</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-xs text-text-muted">Max Retries</span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={config.maxRetries}
                          onChange={(e) => setConfig({ ...config, maxRetries: parseInt(e.target.value, 10) || 0 })}
                          className="w-16 rounded-md border border-border bg-bg-surface px-2 py-1 text-xs text-text-main text-right outline-none"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className="text-xs text-text-muted">Timeout (seconds)</span>
                        <input
                          type="number"
                          min={10}
                          max={3600}
                          value={config.timeoutSeconds}
                          onChange={(e) => setConfig({ ...config, timeoutSeconds: parseInt(e.target.value, 10) || 300 })}
                          className="w-16 rounded-md border border-border bg-bg-surface px-2 py-1 text-xs text-text-main text-right outline-none"
                        />
                      </label>
                    </div>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <AgentIcon />
                        <span className="text-sm font-semibold text-text-main">Evidence Chain</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusDot color={config.evidenceEnabled ? 'green' : 'yellow'} size={7} />
                        <span className="text-[10px] text-text-muted">
                          {config.evidenceEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    <label className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">Collect Evidence</span>
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, evidenceEnabled: !config.evidenceEnabled })}
                        className={[
                          'relative h-5 w-9 rounded-full transition-colors',
                          config.evidenceEnabled ? 'bg-success' : 'bg-border',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                            config.evidenceEnabled ? 'translate-x-4' : 'translate-x-0.5',
                          ].join(' ')}
                        />
                      </button>
                    </label>
                  </Card>
                </motion.div>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="rounded-lg px-6 py-2 text-sm font-semibold transition-transform hover:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: 'var(--color-text-main)',
                    color: 'var(--color-bg-base)',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-center">
                  <span className="text-xs text-error">{error}</span>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
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
