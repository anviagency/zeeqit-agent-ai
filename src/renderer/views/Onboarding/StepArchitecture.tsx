import { useOnboardingStore, type OnboardingModules } from '@/store/onboarding.store'

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
]

/**
 * Step 1: Module selection with borderless rows and spec-style toggles.
 */
export function StepArchitecture(): React.JSX.Element {
  const { modules: selected, setModule } = useOnboardingStore()

  return (
    <div>
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

          {/* Custom toggle matching spec exactly */}
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
  )
}
