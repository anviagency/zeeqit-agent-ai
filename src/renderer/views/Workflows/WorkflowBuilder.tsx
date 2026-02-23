import { useState } from 'react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { useWorkflowStore } from '@/store/workflow.store'
import { api } from '@/api'

interface BuilderFormState {
  targetUrl: string
  extractionGoal: string
  mode: string
  schedule: string
}

interface FormErrors {
  targetUrl?: string
  extractionGoal?: string
}

const MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'apify-only', label: 'Apify Only' },
  { value: 'browser-only', label: 'Browser Only' }
]

/**
 * Workflow creation form with URL input, extraction goal, mode selection,
 * and optional cron schedule.
 *
 * @param props.onCreated - Callback fired after successful creation
 */
export function WorkflowBuilder({
  onCreated
}: {
  onCreated?: () => void
}): React.JSX.Element {
  const [creating, setCreating] = useState(false)
  const setWorkflows = useWorkflowStore((s) => s.setWorkflows)
  const workflows = useWorkflowStore((s) => s.workflows)
  const [errors, setErrors] = useState<FormErrors>({})

  const [form, setForm] = useState<BuilderFormState>({
    targetUrl: '',
    extractionGoal: '',
    mode: 'auto',
    schedule: ''
  })

  const set = <K extends keyof BuilderFormState>(key: K, value: BuilderFormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = (): boolean => {
    const next: FormErrors = {}
    try {
      if (!form.targetUrl) {
        next.targetUrl = 'Target URL is required'
      } else {
        new URL(form.targetUrl)
      }
    } catch {
      next.targetUrl = 'Enter a valid URL (e.g. https://example.com)'
    }
    if (!form.extractionGoal.trim()) {
      next.extractionGoal = 'Extraction goal is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleCreate = async (): Promise<void> => {
    if (!validate()) return
    try {
      setCreating(true)
      const result = await api.workflow.create({
        targetUrl: form.targetUrl,
        extractionGoal: form.extractionGoal,
        mode: form.mode,
        schedule: form.schedule || undefined
      })
      if (result.success) {
        const listResult = await api.workflow.list()
        if (listResult.success && listResult.data) {
          setWorkflows(listResult.data as typeof workflows)
        }
        setForm({ targetUrl: '', extractionGoal: '', mode: 'auto', schedule: '' })
        onCreated?.()
      }
    } catch {
      // error handling delegated to global error boundary
    } finally {
      setCreating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-text-main">Create Workflow</h2>
        <p className="mt-1 text-sm text-text-muted">
          Define a new extraction workflow with target, goal, and execution mode.
        </p>
      </div>

      <Input
        label="Target URL"
        placeholder="https://example.com/data"
        value={form.targetUrl}
        onChange={(e) => set('targetUrl', e.target.value)}
        error={errors.targetUrl}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-muted">Extraction Goal</label>
        <textarea
          rows={3}
          placeholder="Describe what data to extract..."
          value={form.extractionGoal}
          onChange={(e) => set('extractionGoal', e.target.value)}
          className={[
            'w-full rounded-lg border bg-bg-surface px-4 py-2.5 text-sm text-text-main',
            'placeholder:text-text-muted focus:outline-none transition-colors resize-none',
            errors.extractionGoal ? 'border-error' : 'border-border focus:border-border-hover'
          ].join(' ')}
        />
        {errors.extractionGoal && (
          <span className="text-xs text-error">{errors.extractionGoal}</span>
        )}
      </div>

      <Dropdown
        label="Execution Mode"
        options={MODE_OPTIONS}
        value={form.mode}
        onChange={(v) => set('mode', v)}
      />

      <Input
        label="Schedule (optional)"
        placeholder="0 */6 * * * (cron expression)"
        value={form.schedule}
        onChange={(e) => set('schedule', e.target.value)}
      />

      <Button variant="primary" size="md" loading={creating} onClick={handleCreate}>
        Create Workflow
      </Button>
    </motion.div>
  )
}
