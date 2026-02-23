import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { StatusDot } from './ui/StatusDot'
import { AffiliateLink } from './ui/AffiliateLink'

type NavId = 'workflows' | 'cost-analytics' | 'multi-agent' | 'settings'

interface SidebarProps {
  activeNav: NavId
  onNavigate: (id: NavId) => void
  goLoginProfileName?: string
  goLoginConnected?: boolean
}

interface NavItem {
  id: NavId
  label: string
  icon: ReactNode
  badge?: string
  group?: string
}

const GOLOGIN_AFFILIATE_URL = 'https://gologin.com/join/zeeqit-IILQREB'

const navItems: NavItem[] = [
  { id: 'workflows', label: 'Workflows', icon: <WorkflowsIcon /> },
  { id: 'cost-analytics', label: 'Cost Analytics', icon: <CostIcon />, badge: 'P3', group: 'phase3' },
  { id: 'multi-agent', label: 'Multi-Agent', icon: <MultiAgentIcon />, badge: 'P3', group: 'phase3' },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> }
]

/**
 * Main dashboard sidebar with branding, navigation, and GoLogin widget.
 * Fixed width: 280px.
 *
 * @example
 * <Sidebar activeNav="workflows" onNavigate={setView} />
 */
export function Sidebar({
  activeNav,
  onNavigate,
  goLoginProfileName,
  goLoginConnected = false
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-bg-base">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-6 py-6">
        <DiamondLogo />
        <span className="text-lg font-semibold tracking-tight text-text-main">
          zeeqit
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item, idx) => {
          const isActive = item.id === activeNav
          const showDivider = item.group === 'phase3' &&
            (idx === 0 || navItems[idx - 1]?.group !== 'phase3')
          return (
            <div key={item.id}>
              {showDivider && (
                <div className="mt-3 mb-1 px-3">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">
                    Phase 3
                  </span>
                </div>
              )}
              <motion.button
                type="button"
                onClick={() => onNavigate(item.id)}
                whileTap={{ scale: 0.98 }}
                className={[
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-bg-base'
                    : 'text-text-muted hover:bg-bg-hover hover:text-text-main'
                ].join(' ')}
              >
                <span className="flex h-5 w-5 items-center justify-center">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className={[
                    'rounded px-1.5 py-0.5 text-[9px] font-medium',
                    isActive ? 'bg-bg-base/20 text-bg-base' : 'bg-accent/10 text-accent'
                  ].join(' ')}>
                    {item.badge}
                  </span>
                )}
              </motion.button>
            </div>
          )
        })}
      </nav>

      {/* GoLogin Widget */}
      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-text-muted">GoLogin Profile</span>
          <StatusDot
            color={goLoginConnected ? 'green' : 'red'}
            pulse={goLoginConnected}
            size={6}
          />
        </div>

        {goLoginProfileName && (
          <p className="mb-3 truncate font-mono text-sm text-text-main">
            {goLoginProfileName}
          </p>
        )}

        <AffiliateLink
          href={GOLOGIN_AFFILIATE_URL}
          prompt="Don't have an account?"
          label="Get GoLogin"
        />
      </div>
    </aside>
  )
}

/* ---------- SVG Icons ---------- */

function DiamondLogo(): React.JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L22 12L12 22L2 12L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-accent"
      />
      <path
        d="M12 7L17 12L12 17L7 12L12 7Z"
        fill="currentColor"
        className="text-accent"
      />
    </svg>
  )
}

function SkillLibraryIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <line x1="9" y1="7" x2="16" y2="7" />
      <line x1="9" y1="11" x2="14" y2="11" />
    </svg>
  )
}

function WorkflowsIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  )
}

function CostIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  )
}

function MultiAgentIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function SettingsIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.85 1 1.51 1.08H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" />
    </svg>
  )
}
