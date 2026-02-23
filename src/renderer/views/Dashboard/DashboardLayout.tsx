import { useState } from 'react'
import { useAppStore, type DashboardView } from '@/store/app.store'
import { useGateway } from '@/hooks/useGateway'
import { TopBar } from '@/components/TopBar'
import { TopologyView } from '@/views/Topology/TopologyView'
import { SkillLibraryView } from '@/views/SkillLibrary/SkillLibraryView'
import { IntegrationStoreView } from '@/views/IntegrationStore/IntegrationStoreView'
import { SettingsView } from '@/views/Settings/SettingsView'
import { WorkflowsView } from '@/views/Workflows/WorkflowsView'
import { CostAnalyticsView } from '@/views/CostAnalytics/CostAnalyticsView'
import { MultiAgentView } from '@/views/MultiAgent/MultiAgentView'

const viewComponents: Record<DashboardView, React.ComponentType> = {
  topology: TopologyView,
  skills: SkillLibraryView,
  store: IntegrationStoreView,
  settings: SettingsView,
  workflows: WorkflowsView,
  'cost-analytics': CostAnalyticsView,
  'multi-agent': MultiAgentView,
}

interface NavItem {
  id: DashboardView
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  {
    id: 'workflows',
    label: 'Workflow Builder',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: 'topology',
    label: 'Runtime Topology',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: 'skills',
    label: 'Skill Library',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

const GOLOGIN_AFFILIATE_URL = 'https://gologin.com/join/zeeqit-IILQREB'

/**
 * Main dashboard shell matching the spec HTML design exactly.
 * Sidebar (280px) with backdrop blur + main content area with top bar.
 */
export function DashboardLayout(): React.JSX.Element {
  const currentView = useAppStore((s) => s.currentView) as DashboardView
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const { state: gwState } = useGateway()
  const [searchValue, setSearchValue] = useState('')

  const ActiveView = viewComponents[currentView] ?? TopologyView

  return (
    <div className="relative flex h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Ambient background FX */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: [
            `radial-gradient(circle at 50% 0%, rgba(var(--ambient-rgb), 0.03) 0%, transparent 60%)`,
            `linear-gradient(rgba(var(--ambient-rgb), 0.02) 1px, transparent 1px)`,
            `linear-gradient(90deg, rgba(var(--ambient-rgb), 0.02) 1px, transparent 1px)`,
          ].join(', '),
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
          transition: 'all 0.3s ease',
        }}
      />

      {/* Sidebar */}
      <aside
        className="relative z-10 flex w-[280px] shrink-0 flex-col border-r"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-bg-surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          transition: 'border-color 0.3s, background 0.3s',
          padding: '24px 20px',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 mb-10">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-main">
            <polygon points="12 2 2 12 12 22 22 12 12 2" />
          </svg>
          <span className="text-base font-semibold tracking-tight text-text-main">
            zeeqit
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentView(item.id)}
                className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13px] font-medium transition-all cursor-pointer"
                style={{
                  color: isActive ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
                  background: isActive ? 'var(--color-text-main)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--color-text-main)'
                    e.currentTarget.style.background = 'var(--color-bg-hover)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--color-text-muted)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span className="flex h-4 w-4 items-center justify-center">{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* GoLogin widget */}
        <div
          className="rounded-xl p-4 border"
          style={{
            borderColor: 'var(--color-border)',
            background: 'transparent',
            transition: 'border-color 0.3s',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-text-muted font-medium">
              GoLogin Profile
            </span>
            <span
              className="h-1.5 w-1.5 rounded-full bg-success"
              style={{ boxShadow: '0 0 8px var(--color-success)' }}
            />
          </div>
          <div className="font-mono text-xs text-text-main mb-3">
            APEX-Primary-01
          </div>
          <a
            href={GOLOGIN_AFFILIATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-md border text-xs font-medium text-text-main no-underline transition-all"
            style={{
              borderColor: 'var(--color-border)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-bg-hover)'
              e.currentTarget.style.borderColor = 'var(--color-border-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--color-border)'
            }}
          >
            Manage GoLogin
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          gatewayState={{ state: gwState }}
        />
        <ActiveView />
      </main>
    </div>
  )
}
