import { useState, useEffect, useCallback } from 'react'
import { ConfigDiffModal } from './ConfigDiffModal'
import { api } from '@/api'

const GOLOGIN_AFFILIATE_URL = 'https://gologin.com/join/zeeqit-IILQREB'

interface VaultFieldConfig {
  service: string
  key: string
  label: string
  type: 'text' | 'password'
}

const BROWSER_FIELDS: VaultFieldConfig[] = [
  { service: 'gologin', key: 'api-token', label: 'GoLogin API Token', type: 'password' },
  { service: 'gologin', key: 'profile-id', label: 'Default Profile ID', type: 'text' },
]

const INTELLIGENCE_FIELDS: VaultFieldConfig[] = [
  { service: 'openai', key: 'api-key', label: 'OpenAI API Key', type: 'password' },
  { service: 'anthropic', key: 'api-key', label: 'Anthropic API Key', type: 'password' },
]

interface FieldState {
  masked: string | null
  exists: boolean
  editing: boolean
  editValue: string
  saving: boolean
}

type VaultState = Record<string, FieldState>

function fieldId(service: string, key: string): string {
  return `${service}/${key}`
}

/**
 * Settings page — loads real credentials from the vault.
 * 2-column grid: Browser Engine + Intelligence Providers.
 */
export function SettingsView(): React.JSX.Element {
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffContent, setDiffContent] = useState('')
  const [applying, setApplying] = useState(false)
  const [vaultState, setVaultState] = useState<VaultState>({})

  const allFields = [...BROWSER_FIELDS, ...INTELLIGENCE_FIELDS]

  const loadVaultData = useCallback(async () => {
    const newState: VaultState = {}
    const results = await Promise.all(
      allFields.map(async (f) => {
        const id = fieldId(f.service, f.key)
        try {
          const result = await api.vault.get(f.service, f.key)
          if (result.success && result.data) {
            const data = result.data as { exists: boolean; masked: string | null }
            return { id, exists: data.exists, masked: data.masked }
          }
        } catch {
          // vault unavailable
        }
        return { id, exists: false, masked: null }
      })
    )

    for (const r of results) {
      newState[r.id] = {
        masked: r.masked,
        exists: r.exists,
        editing: false,
        editValue: '',
        saving: false,
      }
    }
    setVaultState(newState)
  }, [])

  useEffect(() => {
    void loadVaultData()
  }, [loadVaultData])

  const startEdit = (service: string, key: string): void => {
    const id = fieldId(service, key)
    setVaultState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { masked: null, exists: false, editValue: '', saving: false }), editing: true, editValue: '' },
    }))
  }

  const cancelEdit = (service: string, key: string): void => {
    const id = fieldId(service, key)
    setVaultState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { masked: null, exists: false, editValue: '', saving: false }), editing: false, editValue: '' },
    }))
  }

  const saveField = async (service: string, key: string): Promise<void> => {
    const id = fieldId(service, key)
    const state = vaultState[id]
    if (!state?.editValue.trim()) return

    setVaultState((prev) => ({
      ...prev,
      [id]: { ...prev[id]!, saving: true },
    }))

    try {
      await api.vault.store(service, key, state.editValue.trim())
      // Reload this field to get fresh masked value
      const result = await api.vault.get(service, key)
      const data = result.success && result.data
        ? (result.data as { exists: boolean; masked: string | null })
        : { exists: true, masked: null }
      setVaultState((prev) => ({
        ...prev,
        [id]: {
          masked: data.masked,
          exists: data.exists,
          editing: false,
          editValue: '',
          saving: false,
        },
      }))
    } catch {
      setVaultState((prev) => ({
        ...prev,
        [id]: { ...prev[id]!, saving: false },
      }))
    }
  }

  const handlePreviewDiff = async (): Promise<void> => {
    try {
      const result = await api.config.diff({})
      if (result.success && result.data) {
        setDiffContent(result.data)
        setDiffOpen(true)
      }
    } catch {
      // handled globally
    }
  }

  const handleApply = async (): Promise<void> => {
    try {
      setApplying(true)
      await api.config.apply({})
      setDiffOpen(false)
    } catch {
      // handled globally
    } finally {
      setApplying(false)
    }
  }

  const renderVaultField = (field: VaultFieldConfig): React.JSX.Element => {
    const id = fieldId(field.service, field.key)
    const state = vaultState[id]

    return (
      <div key={id} className="mb-5">
        <label className="block text-xs uppercase tracking-wider text-text-muted mb-2">
          {field.label}
        </label>

        {state?.editing ? (
          <div className="flex gap-2">
            <input
              type={field.type}
              value={state.editValue}
              onChange={(e) => {
                const val = e.target.value
                setVaultState((prev) => ({
                  ...prev,
                  [id]: { ...prev[id]!, editValue: val },
                }))
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') void saveField(field.service, field.key) }}
              placeholder={`Enter ${field.label.toLowerCase()}...`}
              autoFocus
              className="flex-1 rounded-lg border p-3 font-mono text-[13px] text-text-main outline-none transition-colors"
              style={{
                background: 'var(--color-bg-base)',
                borderColor: 'var(--color-text-main)',
              }}
            />
            <button
              type="button"
              onClick={() => void saveField(field.service, field.key)}
              disabled={state.saving || !state.editValue.trim()}
              className="rounded-lg px-4 text-xs font-semibold transition-transform hover:scale-[0.97]"
              style={{
                background: 'var(--color-text-main)',
                color: 'var(--color-bg-base)',
                opacity: state.saving || !state.editValue.trim() ? 0.5 : 1,
              }}
            >
              {state.saving ? '...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => cancelEdit(field.service, field.key)}
              className="rounded-lg border px-3 text-xs text-text-muted transition-colors hover:text-text-main"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div
            className="flex items-center justify-between rounded-lg border p-3 cursor-pointer group transition-colors"
            style={{
              background: 'var(--color-bg-base)',
              borderColor: 'var(--color-border)',
            }}
            onClick={() => startEdit(field.service, field.key)}
          >
            <span
              className="font-mono text-[13px]"
              style={{ color: state?.exists ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}
            >
              {state?.exists ? state.masked : 'Not configured'}
            </span>
            <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
              {state?.exists ? 'Edit' : 'Set'}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-10 py-6" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-text-main">System Configuration</h1>
          <p className="mt-1 text-sm text-text-muted">Manage providers, authentication, and security gates.</p>
        </div>
        <button
          type="button"
          onClick={() => void handlePreviewDiff()}
          className="text-xs text-text-muted hover:text-text-main transition-colors underline underline-offset-2"
        >
          Preview Config Diff
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="grid grid-cols-2 gap-6">
          {/* Browser Engine card */}
          <div
            className="rounded-2xl border p-6"
            style={{ borderColor: 'var(--color-border)', transition: 'border-color 0.3s' }}
          >
            <h3 className="mb-4 text-base font-medium text-text-main">Browser Engine</h3>

            {BROWSER_FIELDS.map(renderVaultField)}

            {/* Affiliate CTA */}
            <div
              className="mt-8 rounded-xl border p-5"
              style={{
                borderColor: 'var(--color-border)',
                background: 'rgba(var(--ambient-rgb), 0.03)',
              }}
            >
              <h4 className="text-sm font-medium text-text-main mb-2">Need more profiles?</h4>
              <p className="text-xs text-text-muted leading-relaxed mb-4">
                Get dedicated anti-detect browser environments to prevent session bans.
              </p>
              <a
                href={GOLOGIN_AFFILIATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-4 py-2.5 text-xs font-semibold no-underline transition-transform hover:scale-[0.97]"
                style={{
                  background: 'var(--color-text-main)',
                  color: 'var(--color-bg-base)',
                }}
              >
                Open GoLogin
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>

          {/* Intelligence Providers card */}
          <div
            className="rounded-2xl border p-6"
            style={{ borderColor: 'var(--color-border)', transition: 'border-color 0.3s' }}
          >
            <h3 className="mb-4 text-base font-medium text-text-main">Intelligence Providers</h3>

            {INTELLIGENCE_FIELDS.map(renderVaultField)}
          </div>
        </div>
      </div>

      <ConfigDiffModal
        isOpen={diffOpen}
        diff={diffContent}
        onConfirm={() => void handleApply()}
        onCancel={() => setDiffOpen(false)}
        loading={applying}
      />
    </div>
  )
}
