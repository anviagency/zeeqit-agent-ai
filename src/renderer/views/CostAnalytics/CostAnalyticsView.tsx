import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'

interface ProviderCost {
  name: string
  callCount: number
  estimatedCost: number
  lastUsed: string | null
}

const PROVIDERS: ProviderCost[] = [
  { name: 'OpenAI', callCount: 0, estimatedCost: 0, lastUsed: null },
  { name: 'Anthropic', callCount: 0, estimatedCost: 0, lastUsed: null },
  { name: 'GoLogin', callCount: 0, estimatedCost: 0, lastUsed: null },
  { name: 'Apify', callCount: 0, estimatedCost: 0, lastUsed: null }
]

const SUMMARY_CARDS = [
  { label: 'Today', amount: '$0.00' },
  { label: 'This Week', amount: '$0.00' },
  { label: 'This Month', amount: '$0.00' }
]

const DAILY_BUDGET = 10.0
const DAILY_USAGE = 0.0

/**
 * Cost analytics dashboard showing spend breakdown by provider and time period.
 * Phase 3 placeholder with live data integration planned.
 */
export function CostAnalyticsView(): React.JSX.Element {
  const usagePercent = DAILY_BUDGET > 0 ? Math.min((DAILY_USAGE / DAILY_BUDGET) * 100, 100) : 0

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
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {SUMMARY_CARDS.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card className="p-5">
                  <span className="text-xs text-text-muted">{card.label}</span>
                  <span className="mt-1 block text-2xl font-semibold text-text-main">
                    {card.amount}
                  </span>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Daily budget */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-main">Daily Budget</span>
              <span className="text-xs text-text-muted">
                ${DAILY_USAGE.toFixed(2)} / ${DAILY_BUDGET.toFixed(2)}
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
              {PROVIDERS.map((provider, i) => (
                <motion.div
                  key={provider.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                >
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-text-main">{provider.name}</span>
                      <ProviderIcon name={provider.name} />
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

          {/* Phase note */}
          <div className="rounded-lg border border-border bg-bg-surface px-4 py-3 text-center">
            <span className="text-xs text-text-muted">
              Phase 3 — Enhanced analytics with historical charts and alerts coming soon
            </span>
          </div>
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

function ProviderIcon({ name }: { name: string }): React.JSX.Element {
  const initial = name.charAt(0)
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-bg-hover text-[10px] font-bold text-text-muted">
      {initial}
    </span>
  )
}
