import { useState } from 'react'
import { ConfigDiffModal } from './ConfigDiffModal'

const GOLOGIN_AFFILIATE_URL = 'https://gologin.com/join/zeeqit-IILQREB'

/**
 * Settings page matching the spec HTML design.
 * 2-column grid: Browser Engine + Intelligence Providers.
 */
export function SettingsView(): React.JSX.Element {
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffContent, setDiffContent] = useState('')
  const [applying, setApplying] = useState(false)

  const handlePreviewDiff = async (): Promise<void> => {
    try {
      const result = await window.zeeqitApi.config.diff({})
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
      await window.zeeqitApi.config.apply({})
      setDiffOpen(false)
    } catch {
      // handled globally
    } finally {
      setApplying(false)
    }
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
          onClick={handlePreviewDiff}
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

            <SettingsInput label="GoLogin API Token" type="password" defaultValue="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
            <SettingsInput label="Default Profile ID" type="text" defaultValue="65e8a9b2c4d1f30001a2b3c4" />

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

            <SettingsInput label="OpenAI API Key" type="password" defaultValue="sk-proj-*******************" />
            <SettingsInput label="Anthropic API Key" type="password" defaultValue="sk-ant-*******************" />

            <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                type="button"
                className="w-full rounded-md py-3 text-xs font-semibold transition-transform hover:scale-[0.97]"
                style={{
                  background: 'var(--color-text-main)',
                  color: 'var(--color-bg-base)',
                }}
              >
                Save Configurations
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfigDiffModal
        isOpen={diffOpen}
        diff={diffContent}
        onConfirm={handleApply}
        onCancel={() => setDiffOpen(false)}
        loading={applying}
      />
    </div>
  )
}

function SettingsInput({
  label,
  type,
  defaultValue
}: {
  label: string
  type: 'text' | 'password'
  defaultValue?: string
}): React.JSX.Element {
  const [value, setValue] = useState(defaultValue ?? '')

  return (
    <div className="mb-5">
      <label className="block text-xs uppercase tracking-wider text-text-muted mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-lg border p-3 font-mono text-[13px] text-text-main outline-none transition-colors"
        style={{
          background: 'var(--color-bg-base)',
          borderColor: 'var(--color-border)',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-text-main)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
      />
    </div>
  )
}
