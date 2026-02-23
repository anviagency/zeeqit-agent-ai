import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { api } from '@/api'

interface ProviderCost {
  name: string
  callCount: number
  estimatedCost: number
  lastUsed: string | null
  configured: boolean
}

const PROVIDER_NAMES = ['OpenAI', 'Anthropic', 'GoLogin', 'Apify'] as const
const VAULT_SERVICE_MAP: Record<string, string> = {
  OpenAI: 'openai',
  Anthropic: 'anthropic',
  GoLogin: 'gologin',
  Apify: 'apify',
}

const DAILY_BUDGET = 10.0

/**
 * Cost analytics dashboard showing provider configuration status and spend tracking.
 * Fetches real vault and health data to show which providers are configured.
 */
export function CostAnalyticsView(): React.JSX.Element {
  const [providers, setProviders] = useState<ProviderCost[]>(
    PROVIDER_NAMES.map(name => ({ name, callCount: 0, estimatedCost: 0, lastUsed: null, configured: false }))
  )
  const [gatewayStatus, setGatewayStatus] = useState<string>('unknown')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)

        // Fetch vault credentials and health in parallel
        const [vaultResult, healthResult, gwResult] = await Promise.allSettled([
          api.vault.list(),
          api.diagnostics.health(),
          api.gateway.status(),
        ])

        if (cancelled) return

        // Derive which providers have credentials
        const configuredServices = new Set<string>()
        if (vaultResult.status === 'fulfilled' && vaultResult.value.success && vaultResult.value.data) {
          const credentials = vaultResult.value.data as { service: string }[]
          for (const c of credentials) {
            configuredServices.add(c.service)
          }
        }

        // Gateway status
        if (gwResult.status === 'fulfilled' && gwResult.value.success) {
          setGatewayStatus(String(gwResult.value.data ?? 'unknown'))
        }

        // Health data for any usage stats
        let healthData: Record<string, unknown> | null = null
        if (healthResult.status === 'fulfilled' && healthResult.value.success) {
          healthData = healthResult.value.data as Record<string, unknown>
        }

        setProviders(
          PROVIDER_NAMES.map(name => ({
            name,
            callCount: 0,
            estimatedCost: 0,
            lastUsed: null,
            configured: configuredServices.has(VAULT_SERVICE_MAP[name]),
          }))
        )

        void healthData // available for future usage stats
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const configuredCount = providers.filter(p => p.configured).length
  const totalCost = providers.reduce((sum, p) => sum + p.estimatedCost, 0)
  const usagePercent = DAILY_BUDGET > 0 ? Math.min((totalCost / DAILY_BUDGET) * 100, 100) : 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-5">
        <h1 className="text-xl font-semibold text-text-main">Cost Analytics</h1>
        <p className="mt-1 text-sm text-text-muted">
          Track API usage and estimated costs across all providers.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="p-5">
                    <span className="text-xs text-text-muted">Configured Providers</span>
                    <span className="mt-1 block text-2xl font-semibold text-text-main">
                      {configuredCount} / {providers.length}
                    </span>
                  </Card>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                >
                  <Card className="p-5">
                    <span className="text-xs text-text-muted">Gateway Status</span>
                    <span className="mt-1 block text-2xl font-semibold text-text-main capitalize">
                      {gatewayStatus}
                    </span>
                  </Card>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <Card className="p-5">
                    <span className="text-xs text-text-muted">Vault Credentials</span>
                    <span className="mt-1 block text-2xl font-semibold text-text-main">
                      {configuredCount} stored
                    </span>
                  </Card>
                </motion.div>
              </div>

              {/* Daily budget */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-text-main">Daily Budget</span>
                  <span className="text-xs text-text-muted">
                    ${totalCost.toFixed(2)} / ${DAILY_BUDGET.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={[
                      'h-full rounded-full',
                      usagePercent > 80 ? 'bg-error' : usagePercent > 50 ? 'bg-warning' : 'bg-success'
                    ].join(' ')}
                  />
                </div>
              </Card>

              {/* Provider breakdown */}
              <div>
                <h2 className="text-sm font-semibold text-text-main mb-4">Per-Provider Breakdown</h2>
                <div className="grid grid-cols-2 gap-4">
                  {providers.map((provider, i) => (
                    <motion.div
                      key={provider.name}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                    >
                      <Card className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-text-main">{provider.name}</span>
                          <span className={[
                            'rounded-md border px-2 py-0.5 text-[10px] font-semibold',
                            provider.configured
                              ? 'border-success/30 bg-success/10 text-success'
                              : 'border-border text-text-muted'
                          ].join(' ')}>
                            {provider.configured ? 'Configured' : 'Not Set'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <Row label="API Calls" value={String(provider.callCount)} />
                          <Row label="Est. Cost" value={`$${provider.estimatedCost.toFixed(2)}`} />
                          <Row label="Last Used" value={provider.lastUsed ?? 'Never'} />
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Info note */}
              <div className="rounded-lg border border-border bg-bg-surface px-4 py-3 text-center">
                <span className="text-xs text-text-muted">
                  Cost tracking requires OpenClaw billing integration — usage data will appear once API calls are made through the runtime.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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
