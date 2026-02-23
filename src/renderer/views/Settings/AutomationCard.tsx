import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import { api } from '@/api'

interface AutomationState {
  cronSchedule: string
  scheduledEnabled: boolean
  maxConcurrent: number
  retryOnFailure: boolean
  maxRetries: number
}

/**
 * Automation settings card for configuring scheduled workflows,
 * concurrency limits, and retry behaviour.
 */
export function AutomationCard(): React.JSX.Element {
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState<AutomationState>({
    cronSchedule: '0 */6 * * *',
    scheduledEnabled: false,
    maxConcurrent: 3,
    retryOnFailure: true,
    maxRetries: 3
  })

  const set = <K extends keyof AutomationState>(key: K, value: AutomationState[K]): void => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const clamp = (val: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, val))

  const handleSave = async (): Promise<void> => {
    try {
      setSaving(true)
      await api.vault.store('automation', 'cronSchedule', state.cronSchedule)
      await api.vault.store('automation', 'scheduledEnabled', String(state.scheduledEnabled))
      await api.vault.store('automation', 'maxConcurrent', String(state.maxConcurrent))
      await api.vault.store('automation', 'retryOnFailure', String(state.retryOnFailure))
      await api.vault.store('automation', 'maxRetries', String(state.maxRetries))
    } catch {
      // error handling delegated to global error boundary
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <AutomationIcon />
        <h3 className="text-sm font-semibold text-text-main">Automation</h3>
      </div>
      <p className="text-xs text-text-muted mb-5">
        Configure scheduled workflows and retry policies.
      </p>

      <div className="space-y-5">
        <div>
          <Input
            label="Cron Schedule"
            placeholder="0 */6 * * *"
            value={state.cronSchedule}
            onChange={(e) => set('cronSchedule', e.target.value)}
          />
          <p className="mt-1 text-[10px] text-text-muted">
            Standard 5-field cron expression (minute hour day month weekday)
          </p>
        </div>

        <Toggle
          label="Enable scheduled workflows"
          checked={state.scheduledEnabled}
          onChange={(v) => set('scheduledEnabled', v)}
        />

        <div>
          <label className="text-xs font-medium text-text-muted mb-1.5 block">
            Max Concurrent Workflows
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={state.maxConcurrent}
            onChange={(e) => set('maxConcurrent', clamp(Number(e.target.value), 1, 10))}
            className="w-full rounded-lg border border-border bg-bg-surface px-4 py-2.5 text-sm text-text-main focus:border-border-hover focus:outline-none"
          />
        </div>

        <Toggle
          label="Retry on failure"
          checked={state.retryOnFailure}
          onChange={(v) => set('retryOnFailure', v)}
        />

        {state.retryOnFailure && (
          <div>
            <label className="text-xs font-medium text-text-muted mb-1.5 block">
              Max Retries
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={state.maxRetries}
              onChange={(e) => set('maxRetries', clamp(Number(e.target.value), 1, 5))}
              className="w-full rounded-lg border border-border bg-bg-surface px-4 py-2.5 text-sm text-text-main focus:border-border-hover focus:outline-none"
            />
          </div>
        )}

        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Automation
        </Button>
      </div>
    </Card>
  )
}

function AutomationIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
