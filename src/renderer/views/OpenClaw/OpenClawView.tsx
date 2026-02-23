import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/api'

/* ── Types ─────────────────────────────────────────────── */

type OpenClawTab = 'overview' | 'workspace' | 'agents' | 'cron' | 'logs'

const TABS: { id: OpenClawTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'agents', label: 'Agents' },
  { id: 'cron', label: 'Cron' },
  { id: 'logs', label: 'Logs' },
]

const WORKSPACE_FILES = [
  'SOUL.md', 'USER.md', 'IDENTITY.md', 'TOOLS.md',
  'AGENTS.md', 'HEARTBEAT.md', 'BOOTSTRAP.md',
]

/* ── Card wrapper ──────────────────────────────────────── */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <div
      className={`rounded-2xl border p-6 ${className}`}
      style={{ borderColor: 'var(--color-border)', transition: 'border-color 0.3s' }}
    >
      {children}
    </div>
  )
}

/* ── Overview Tab ──────────────────────────────────────── */

function OverviewTab(): React.JSX.Element {
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.openclawFiles.getOverview().then((result) => {
      if (result.success && result.data) setOverview(result.data as Record<string, unknown>)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-text-muted text-sm">Loading...</div>
  if (!overview) return <div className="text-text-muted text-sm">Failed to load overview</div>

  const config = overview.config as Record<string, unknown> | null
  const identity = overview.identity as Record<string, unknown> | null
  const workspaceFiles = (overview.workspaceFiles ?? []) as Array<{ name: string; size: number }>

  return (
    <div className="grid grid-cols-2 gap-6">
      <Card>
        <h3 className="mb-4 text-base font-medium text-text-main">Gateway Configuration</h3>
        {config ? (
          <dl className="space-y-3 text-sm">
            {([
              ['Port', config.gatewayPort],
              ['Mode', config.gatewayMode],
              ['Bind', config.gatewayBind],
              ['Auth', config.authMode],
              ['Max Agents', config.maxConcurrentAgents],
              ['Max Subagents', config.maxSubagents],
              ['Version', config.lastTouchedVersion],
            ] as [string, unknown][]).map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-text-muted">{label}</dt>
                <dd className="font-mono text-text-main">{String(value ?? 'N/A')}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-text-muted text-sm">Config not available</p>
        )}
      </Card>

      <Card>
        <h3 className="mb-4 text-base font-medium text-text-main">Device Identity</h3>
        {identity ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-text-muted mb-1">Device ID</dt>
              <dd className="font-mono text-xs text-text-main break-all">
                {String(identity.deviceId)}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted mb-1">Public Key</dt>
              <dd className="font-mono text-[10px] text-text-main break-all whitespace-pre-wrap" style={{ lineHeight: 1.4 }}>
                {String(identity.publicKeyPem)}
              </dd>
            </div>
            {identity.createdAtMs && (
              <div className="flex justify-between">
                <dt className="text-text-muted">Created</dt>
                <dd className="font-mono text-text-main text-xs">
                  {new Date(identity.createdAtMs as number).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-text-muted text-sm">Identity not available</p>
        )}
      </Card>

      <Card className="col-span-2">
        <h3 className="mb-4 text-base font-medium text-text-main">Workspace Files</h3>
        <div className="grid grid-cols-4 gap-3">
          {workspaceFiles.map((f) => (
            <div
              key={f.name}
              className="rounded-xl border p-3 text-center"
              style={{ borderColor: 'var(--color-border)', background: f.size > 0 ? 'rgba(var(--ambient-rgb), 0.03)' : 'transparent' }}
            >
              <div className="font-mono text-xs text-text-main mb-1">{f.name}</div>
              <div className="text-[10px] text-text-muted">
                {f.size > 0 ? `${(f.size / 1024).toFixed(1)} KB` : 'empty'}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ── Workspace Tab ─────────────────────────────────────── */

function WorkspaceTab(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState('SOUL.md')
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const loadFile = useCallback(async (filename: string) => {
    setLoading(true)
    setSaved(false)
    try {
      const result = await api.openclawFiles.readWorkspaceFile(filename)
      if (result.success && result.data) {
        const data = result.data as { content: string }
        setContent(data.content)
        setOriginalContent(data.content)
      } else {
        setContent('')
        setOriginalContent('')
      }
    } catch {
      setContent('')
      setOriginalContent('')
    }
    setLoading(false)
  }, [])

  useEffect(() => { void loadFile(selectedFile) }, [selectedFile, loadFile])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    const result = await api.openclawFiles.writeWorkspaceFile(selectedFile, content)
    if (result.success) {
      setOriginalContent(content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  const isDirty = content !== originalContent

  return (
    <div className="flex gap-6" style={{ height: 'calc(100vh - 240px)' }}>
      {/* File list */}
      <div className="w-48 shrink-0 rounded-2xl border p-3" style={{ borderColor: 'var(--color-border)' }}>
        {WORKSPACE_FILES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setSelectedFile(f)}
            className="w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer mb-0.5"
            style={{
              color: selectedFile === f ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
              background: selectedFile === f ? 'var(--color-text-main)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (selectedFile !== f) e.currentTarget.style.background = 'var(--color-bg-hover)'
            }}
            onMouseLeave={(e) => {
              if (selectedFile !== f) e.currentTarget.style.background = 'transparent'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="font-mono text-sm text-text-main">{selectedFile}</span>
          <div className="flex items-center gap-3">
            {isDirty && <span className="text-xs" style={{ color: 'var(--color-warning, #f0ad4e)' }}>Unsaved changes</span>}
            {saved && <span className="text-xs" style={{ color: 'var(--color-success)' }}>Saved</span>}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!isDirty || saving}
              className="rounded-lg px-4 py-1.5 text-xs font-semibold transition-transform hover:scale-[0.97] cursor-pointer"
              style={{
                background: isDirty ? 'var(--color-text-main)' : 'var(--color-bg-hover)',
                color: isDirty ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
                opacity: !isDirty || saving ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <textarea
          value={loading ? 'Loading...' : content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading}
          className="flex-1 w-full resize-none p-4 font-mono text-[13px] leading-relaxed text-text-main outline-none"
          style={{ background: 'transparent', minHeight: 400 }}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

/* ── Agents Tab ────────────────────────────────────────── */

function AgentsTab(): React.JSX.Element {
  const [agents, setAgents] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.openclawFiles.getAgents().then((result) => {
      if (result.success && result.data) setAgents(result.data as Record<string, unknown>)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-text-muted text-sm">Loading...</div>
  if (!agents) return <div className="text-text-muted text-sm">Failed to load agent config</div>

  const auth = agents.auth as Record<string, unknown> | undefined
  const profiles = (auth?.profiles ?? {}) as Record<string, Record<string, unknown>>

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-4 text-base font-medium text-text-main">Auth Profiles</h3>
        <div className="space-y-4">
          {Object.entries(profiles).map(([id, profile]) => (
            <div
              key={id}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-base)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-text-main">{id}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full border text-text-muted"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {String(profile.provider ?? 'unknown')}
                </span>
              </div>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-text-muted">Type</dt>
                  <dd className="font-mono text-text-main">{String(profile.type ?? 'N/A')}</dd>
                </div>
                {profile.key && (
                  <div className="flex justify-between">
                    <dt className="text-text-muted">API Key</dt>
                    <dd className="font-mono text-text-main">{String(profile.key)}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
          {Object.keys(profiles).length === 0 && (
            <p className="text-text-muted text-sm">No auth profiles configured.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

/* ── Cron Tab ──────────────────────────────────────────── */

function CronTab(): React.JSX.Element {
  const [cronData, setCronData] = useState<{ version: number; jobs: Record<string, unknown>[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.openclawFiles.getCron().then((result) => {
      if (result.success && result.data) setCronData(result.data as { version: number; jobs: Record<string, unknown>[] })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-text-muted text-sm">Loading...</div>
  if (!cronData) return <div className="text-text-muted text-sm">Failed to load cron jobs</div>

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-text-main">Cron Jobs</h3>
        <span className="text-xs text-text-muted font-mono">
          {cronData.jobs.length} job{cronData.jobs.length !== 1 ? 's' : ''}
        </span>
      </div>
      {cronData.jobs.length === 0 ? (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-base)' }}
        >
          <p className="text-text-muted text-sm">No cron jobs configured.</p>
          <p className="text-text-muted text-xs mt-1">
            Cron jobs can be created via the Workflow Builder or the openclaw CLI.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cronData.jobs.map((job, idx) => (
            <div
              key={idx}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-base)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-text-main">
                  {String(job.name ?? `Job ${idx + 1}`)}
                </span>
                <span className="font-mono text-xs text-text-muted">
                  {String(job.cron ?? job.schedule ?? 'N/A')}
                </span>
              </div>
              {job.message && (
                <p className="text-xs text-text-muted mt-2 truncate">{String(job.message)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ── Logs Tab ──────────────────────────────────────────── */

function LogsTab(): React.JSX.Element {
  const [activeLog, setActiveLog] = useState<'gateway.log' | 'gateway.err.log'>('gateway.log')
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadLog = useCallback(async () => {
    const result = await api.openclawFiles.tailLog(activeLog, 300)
    if (result.success && result.data) {
      setLines((result.data as { lines: string[] }).lines)
    }
    setLoading(false)
  }, [activeLog])

  useEffect(() => {
    setLoading(true)
    void loadLog()
    pollRef.current = setInterval(() => void loadLog(), 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadLog])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
      <div className="flex gap-2 mb-4">
        {(['gateway.log', 'gateway.err.log'] as const).map((logFile) => (
          <button
            key={logFile}
            type="button"
            onClick={() => setActiveLog(logFile)}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
            style={{
              color: activeLog === logFile ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
              background: activeLog === logFile ? 'var(--color-text-main)' : 'var(--color-bg-hover, rgba(255,255,255,0.05))',
            }}
          >
            {logFile}
          </button>
        ))}
      </div>

      <div
        className="flex-1 rounded-2xl border overflow-y-auto p-4 font-mono text-xs leading-relaxed"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-bg-base)',
          color: 'var(--color-text-main)',
        }}
      >
        {loading ? (
          <span className="text-text-muted">Loading log...</span>
        ) : lines.length === 0 ? (
          <span className="text-text-muted">Log file is empty.</span>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className="whitespace-pre-wrap break-all"
              style={{
                color: line.includes('ERROR') || line.includes('error')
                  ? 'var(--color-danger, #ff5c5c)'
                  : line.includes('WARN') || line.includes('warn')
                    ? 'var(--color-warning, #f0ad4e)'
                    : 'inherit',
              }}
            >
              {line}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}

/* ── Main View ─────────────────────────────────────────── */

export function OpenClawView(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<OpenClawTab>('overview')

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-10 py-6"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-text-main">
            OpenClaw Runtime
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Workspace, agents, cron jobs, and logs.
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b px-10 pt-2" style={{ borderColor: 'var(--color-border)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition-all cursor-pointer"
            style={{
              color: activeTab === tab.id ? 'var(--color-text-main)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-text-main)' : '2px solid transparent',
              background: activeTab === tab.id ? 'var(--color-bg-hover, rgba(255,255,255,0.05))' : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'workspace' && <WorkspaceTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'cron' && <CronTab />}
        {activeTab === 'logs' && <LogsTab />}
      </div>
    </div>
  )
}
