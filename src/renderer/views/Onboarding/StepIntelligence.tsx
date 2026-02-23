import { useOnboardingStore } from '@/store/onboarding.store'

/**
 * Step 2: Giant borderless inputs for persona + API keys.
 * Matches the spec HTML with bottom-border-only inputs at 2rem font.
 */
export function StepIntelligence(): React.JSX.Element {
  const { intelligence, setIntelligence } = useOnboardingStore()

  return (
    <div>
      <OnboardingInput
        label="Agent Persona / Output Language"
        type="text"
        placeholder="e.g. Hebrew, Direct, No BS"
        value={intelligence.persona}
        onChange={(v) => setIntelligence('persona', v)}
      />

      <OnboardingInput
        label="OpenAI API Key (Mini Router)"
        type="password"
        placeholder="sk-proj-..."
        value={intelligence.openaiKey}
        onChange={(v) => setIntelligence('openaiKey', v)}
      />

      <OnboardingInput
        label="Anthropic API Key (Heavy Reasoning)"
        type="password"
        placeholder="sk-ant-..."
        value={intelligence.anthropicKey}
        onChange={(v) => setIntelligence('anthropicKey', v)}
      />
    </div>
  )
}

function OnboardingInput({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string
  type: 'text' | 'password'
  placeholder: string
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div style={{ marginBottom: 40 }}>
      <label
        style={{
          display: 'block',
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          color: '#666',
          marginBottom: 12,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '2px solid rgba(255,255,255,0.2)',
          color: '#fff',
          fontSize: '2rem',
          padding: '10px 0',
          outline: 'none',
          fontWeight: 500,
          letterSpacing: '-0.5px',
          transition: 'border-color 0.3s ease',
          fontFamily: 'inherit',
        }}
        onFocus={(e) => { e.currentTarget.style.borderBottomColor = '#fff' }}
        onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.2)' }}
      />
    </div>
  )
}
