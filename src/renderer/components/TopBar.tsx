import type { GatewayStateEvent } from '@shared/ipc-channels'
import { useAppStore } from '@/store/app.store'

interface TopBarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  gatewayState?: GatewayStateEvent
}

const stateLabel: Record<GatewayStateEvent['state'], string> = {
  connected: 'Runtime Active',
  disconnected: 'Disconnected',
  reconnecting: 'Reconnecting…'
}

const stateColor: Record<GatewayStateEvent['state'], string> = {
  connected: 'bg-success',
  disconnected: 'bg-error',
  reconnecting: 'bg-warning'
}

/**
 * Top bar matching the spec design: search left, theme toggle + status right.
 */
export function TopBar({
  searchValue,
  onSearchChange,
  gatewayState
}: TopBarProps): React.JSX.Element {
  const gwState = gatewayState?.state ?? 'disconnected'
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  return (
    <header
      className="flex h-[70px] shrink-0 items-center justify-between border-b px-10"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-bg-surface)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'border-color 0.3s, background 0.3s'
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-3 w-[300px]">
        <svg width="16" height="16" fill="none" stroke="var(--color-text-muted)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search memory, skills, or type a command..."
          className="w-full bg-transparent border-none text-sm outline-none text-text-main placeholder:text-text-muted"
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-6">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title="Toggle Theme"
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all hover:text-text-main"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-muted)',
            background: 'transparent'
          }}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Connection status */}
        <div className="flex items-center gap-2.5 font-mono text-xs text-text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${stateColor[gwState]}`}
            style={gwState === 'connected' ? { boxShadow: '0 0 8px var(--color-success)' } : undefined}
          />
          {stateLabel[gwState]}
        </div>
      </div>
    </header>
  )
}

function SunIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
