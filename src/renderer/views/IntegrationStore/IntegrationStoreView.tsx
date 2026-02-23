import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/api'

type IntegrationStatus = 'configured' | 'available' | 'coming_soon'

interface Integration {
  id: string
  name: string
  description: string
  status: IntegrationStatus
  icon: React.ReactNode
  category: string
  configKey?: string
  /** Vault service name to check for credential presence. */
  vaultService?: string
}

/** Static integration definitions. Status is derived at runtime from vault. */
const INTEGRATION_DEFS: Omit<Integration, 'status'>[] = [
  // Messaging Channels
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Official Bot API integration for direct agent communication and alerts.',
    category: 'Messaging Channels',
    configKey: 'channels.telegram',
    vaultService: 'telegram',
    icon: <MessageIcon />,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Connect via Baileys QR scan for seamless messaging.',
    category: 'Messaging Channels',
    configKey: 'channels.whatsapp',
    vaultService: 'whatsapp',
    icon: <PhoneIcon />,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Server and DM support for team collaboration and logging.',
    category: 'Messaging Channels',
    configKey: 'channels.discord',
    vaultService: 'discord',
    icon: <BellIcon />,
  },

  // Dev & Automation
  {
    id: 'github',
    name: 'GitHub',
    description: 'Read repos, manage PRs, and triage issues autonomously.',
    category: 'Dev & Automation',
    configKey: 'tools.github',
    vaultService: 'github',
    icon: <GithubIcon />,
  },
  {
    id: 'browser-automation',
    name: 'Browser Automation',
    description: 'Playwright + GoLogin engine for interacting with UI-only web applications.',
    category: 'Dev & Automation',
    configKey: 'tools.browser',
    vaultService: 'gologin',
    icon: <BrowserIcon />,
  },
  {
    id: 'cron-engine',
    name: 'Cron Engine',
    description: 'Schedule proactive tasks, memory consolidation, and health checks.',
    category: 'Dev & Automation',
    configKey: 'automation.cron',
    icon: <CalendarIcon />,
  },
  {
    id: 'apify',
    name: 'Apify',
    description: 'Cloud-based web scraping actors for structured data extraction at scale.',
    category: 'Dev & Automation',
    configKey: 'tools.apify',
    vaultService: 'apify',
    icon: <ExtractIcon />,
  },

  // LLMs & Intelligence
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o & GPT-5-mini models. Currently used as default cheap router.',
    category: 'LLMs & Intelligence',
    configKey: 'agents.defaults.model.primary',
    vaultService: 'openai',
    icon: <DollarIcon />,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet & Opus. Used for high-complexity task escalation.',
    category: 'LLMs & Intelligence',
    configKey: 'agents.defaults.model.fallbacks',
    vaultService: 'anthropic',
    icon: <LayersIcon />,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run local, uncensored models on your hardware for free classification.',
    category: 'LLMs & Intelligence',
    configKey: 'agents.defaults.model.local',
    icon: <ShrinkIcon />,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified API gateway for 100+ models with automatic fallback routing.',
    category: 'LLMs & Intelligence',
    configKey: 'agents.defaults.model.openrouter',
    vaultService: 'openrouter',
    icon: <RouterIcon />,
  },
]

const categories = [...new Set(INTEGRATION_DEFS.map((i) => i.category))]

const statusLabel: Record<IntegrationStatus, string> = {
  configured: 'Configured',
  available: 'Install',
  coming_soon: 'Coming Soon',
}

/**
 * Integration Store view. Shows all available OpenClaw integrations
 * grouped by category. Configured status is derived from real vault data:
 * if a credential exists for the service, it shows as 'configured'.
 */
export function IntegrationStoreView(): React.JSX.Element {
  const [integrations, setIntegrations] = useState<Integration[]>(() =>
    INTEGRATION_DEFS.map(def => ({ ...def, status: 'available' as IntegrationStatus }))
  )
  const [installingId, setInstallingId] = useState<string | null>(null)

  // Fetch vault credentials on mount to derive real status
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await api.vault.list()
        if (cancelled || !result.success || !result.data) return

        const credentials = result.data as { service: string; label: string }[]
        const configuredServices = new Set(credentials.map(c => c.service))

        // Also check if cron engine has any cron jobs configured
        let hasCron = false
        try {
          const cronResult = await api.openclawFiles.getCron()
          if (cronResult.success && cronResult.data) {
            const cronData = cronResult.data as { jobs?: unknown[] }
            hasCron = Array.isArray(cronData.jobs) && cronData.jobs.length > 0
          }
        } catch { /* ignore */ }

        setIntegrations(
          INTEGRATION_DEFS.map(def => {
            let status: IntegrationStatus = 'available'
            if (def.vaultService && configuredServices.has(def.vaultService)) {
              status = 'configured'
            }
            // Cron engine is 'configured' if any cron jobs exist
            if (def.id === 'cron-engine' && hasCron) {
              status = 'configured'
            }
            return { ...def, status }
          })
        )
      } catch {
        // Keep defaults on error
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleInstall = useCallback(async (integration: Integration) => {
    if (integration.status === 'coming_soon') return

    setInstallingId(integration.id)
    try {
      if (integration.configKey) {
        await api.config.apply({
          [integration.configKey.split('.')[0]]: { enabled: true }
        })
      }
    } catch {
      // handled by global error boundary
    } finally {
      setInstallingId(null)
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-10 py-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-text-main">
            Integration Store
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Connect external tools, platforms, and models to your zeeqit runtime.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-10 py-6">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="mb-4 mt-8 border-b border-border pb-2 text-base font-semibold text-text-main first:mt-0">
              {category}
            </h2>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
              <AnimatePresence mode="popLayout">
                {integrations.filter((i) => i.category === category).map((integration) => (
                  <motion.div
                    key={integration.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col rounded-xl border border-border bg-[var(--color-bg-surface)] p-5 transition-all hover:border-[var(--color-border-hover)] hover:-translate-y-0.5"
                  >
                    {/* Top row: icon + button */}
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-[rgba(var(--ambient-rgb),0.05)] text-text-main">
                        {integration.icon}
                      </div>
                      <button
                        type="button"
                        disabled={integration.status === 'coming_soon' || installingId === integration.id}
                        onClick={() => handleInstall(integration)}
                        className={[
                          'rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-all',
                          integration.status === 'configured'
                            ? 'border-success/30 bg-success/10 text-success'
                            : integration.status === 'coming_soon'
                              ? 'cursor-not-allowed border-border bg-transparent text-text-muted opacity-50'
                              : 'border-border bg-transparent text-text-main hover:bg-text-main hover:text-bg-base',
                          installingId === integration.id && 'animate-pulse'
                        ].filter(Boolean).join(' ')}
                      >
                        {installingId === integration.id
                          ? 'Installing…'
                          : statusLabel[integration.status]}
                      </button>
                    </div>

                    {/* Title + description */}
                    <h3 className="mb-1 text-[15px] font-semibold text-text-main">
                      {integration.name}
                    </h3>
                    <p className="flex-1 text-xs leading-relaxed text-text-muted">
                      {integration.description}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Icons ---------- */

function MessageIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function PhoneIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function BellIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function GithubIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  )
}

function BrowserIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function CalendarIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function ExtractIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </svg>
  )
}

function DollarIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function LayersIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

function ShrinkIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

function RouterIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
