import { useOnboardingStore, type OnboardingModules, type InstallMethod } from '@/store/onboarding.store'

interface ModuleRow {
  key: keyof OnboardingModules
  title: string
  description: string
  alwaysOn?: boolean
}

const modules: ModuleRow[] = [
  {
    key: 'core',
    title: 'zeeqit Core',
    description: 'The autonomous orchestrator and memory engine.',
    alwaysOn: true,
  },
  {
    key: 'browser',
    title: 'Browser Identity (GoLogin)',
    description: 'Persistent UI automation with anti-detect profiles.',
  },
  {
    key: 'telegram',
    title: 'Telegram Ingress',
    description: 'Direct remote control via secure bot channel.',
  },
  {
    key: 'apify',
    title: 'Apify Extraction',
    description: 'Cloud-based structured data extraction with actor marketplace.',
  },
]

interface InstallOption {
  id: InstallMethod
  title: string
  command: string
  description: string
}

const installOptions: InstallOption[] = [
  {
    id: 'npm',
    title: 'npm',
    command: 'npm i -g openclaw',
    description: 'Recommended. Requires Node.js installed.',
  },
  {
    id: 'curl',
    title: 'One-liner',
    command: 'curl -fsSL https://openclaw.ai/install.sh | bash',
    description: 'Auto-installs Node.js and everything else.',
  },
  {
    id: 'git',
    title: 'Hackable',
    command: 'git clone + pnpm install + pnpm build',
    description: 'For developers. Build from source.',
  },
]

/**
 * Step 1: Module selection + OpenClaw install method.
 */
export function StepArchitecture(): React.JSX.Element {
  const { modules: selected, setModule, installMethod, setInstallMethod } = useOnboardingStore()

  return (
    <div>
      {/* Install method selector */}
      <div style={{ marginBottom: 40 }}>
        <h3 style={{
          fontSize: '1.2rem',
          fontWeight: 600,
          color: '#fff',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          marginBottom: 20,
        }}>
          OpenClaw Install Method
        </h3>
        <div style={{ display: 'flex', gap: 12 }}>
          {installOptions.map((opt) => {
            const isSelected = installMethod === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInstallMethod(opt.id)}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: `1px solid ${isSelected ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                }}
              >
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: isSelected ? '#fff' : '#999',
                  marginBottom: 6,
                }}>
                  {opt.title}
                </div>
                <div style={{
                  fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
                  fontSize: '0.75rem',
                  color: isSelected ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                  marginBottom: 8,
                  wordBreak: 'break-all',
                }}>
                  {opt.command}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: '#555',
                  lineHeight: 1.4,
                }}>
                  {opt.description}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Module toggles */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        {modules.map((mod) => (
          <div
            key={mod.key}
            className="flex items-center justify-between"
            style={{
              padding: '30px 0',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div>
              <h3 style={{
                fontSize: '1.8rem',
                fontWeight: 500,
                marginBottom: '8px',
                letterSpacing: '-0.5px',
                color: '#fff',
              }}>
                {mod.title}
              </h3>
              <p style={{ color: '#666', fontSize: '1.1rem' }}>
                {mod.description}
              </p>
            </div>

            <label
              className="relative inline-block shrink-0"
              style={{ width: 60, height: 34, cursor: mod.alwaysOn ? 'not-allowed' : 'pointer' }}
            >
              <input
                type="checkbox"
                checked={selected[mod.key]}
                onChange={(e) => {
                  if (!mod.alwaysOn) setModule(mod.key, e.target.checked)
                }}
                disabled={mod.alwaysOn}
                className="absolute opacity-0"
                style={{ width: 0, height: 0 }}
              />
              <span
                className="absolute inset-0 rounded-full transition-all duration-400"
                style={{
                  backgroundColor: selected[mod.key] ? '#fff' : 'rgba(255,255,255,0.1)',
                  opacity: mod.alwaysOn ? 0.3 : 1,
                }}
              >
                <span
                  className="absolute block rounded-full transition-transform duration-400"
                  style={{
                    height: 26,
                    width: 26,
                    left: 4,
                    bottom: 4,
                    backgroundColor: selected[mod.key] ? '#000' : '#fff',
                    transform: selected[mod.key] ? 'translateX(26px)' : 'translateX(0)',
                  }}
                />
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
